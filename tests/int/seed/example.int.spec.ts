import type { CollectionSlug, Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { LEGAL_TEXT_TYPES, PRODUCT_CATEGORIES, PRODUCT_STATUSES } from '@/lib/enums'
import { hashToken } from '@/lib/security/tokens'
import { expectedCount, SEED_EXPECTED_COUNTS } from '@/lib/seed/expected'
import { loadSeedData } from '@/lib/seed/loader'
import { seedCollections } from '@/lib/seed/remove'
import { runSeed, type RunSeedOptions } from '@/lib/seed/run'
import { CANONICAL_SEED_NOW } from '@/lib/seed/time'
import { seedToken } from '@/lib/seed/tokens'
import { fixedClock } from '@/lib/time'

import { getTestPayload } from '../helpers/payload'

// P1.30: Mini-Beispielbestand (SEED-SPEC §1.8, W-21) und Entfernen (DATENMODELL §13.5, SEED-SPEC §18).

// Vollständiger Beispielbestand (P8): Seed-Läufe mit Medien-Pipeline brauchen mehr Zeit als der Standard.
vi.setConfig({ testTimeout: 300_000, hookTimeout: 300_000 })

let payload: Payload
const now = new Date(CANONICAL_SEED_NOW)
const clock = fixedClock('2026-10-15T08:00:30Z')
let realProductId: number
let realProductBefore: string

const ALL_PRODUCTS = Array.from(
  { length: SEED_EXPECTED_COUNTS.products },
  (_, i) => `S${String(i + 1).padStart(2, '0')}`,
)

async function seed(command: RunSeedOptions['command'], extra: Partial<RunSeedOptions> = {}) {
  const data = await loadSeedData({ now, requireBase: command !== 'example' })
  return runSeed(payload, { command, data, now, clock, appEnv: 'test', ...extra })
}

async function countsBySeed(): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  for (const collection of seedCollections(payload)) {
    out[collection] = (
      await payload.count({ collection, where: { seed: { equals: true } }, overrideAccess: true })
    ).totalDocs
  }
  return out
}

async function all(collection: CollectionSlug, where = {}) {
  return (
    await payload.find({
      collection,
      where,
      limit: 0,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })
  ).docs as unknown as Record<string, unknown>[]
}

async function product(key: string) {
  return (await all('products', { seedKey: { equals: `products:${key}` } }))[0]!
}

async function realProductState(): Promise<string> {
  const doc = await payload.findByID({
    collection: 'products',
    id: realProductId,
    depth: 0,
    locale: 'all',
    overrideAccess: true,
  })
  return JSON.stringify(doc)
}

async function baseState() {
  const texts = await all('legal-texts', { status: { equals: 'active' } })
  return {
    categories: (await payload.count({ collection: 'categories', overrideAccess: true })).totalDocs,
    placeholders: texts.filter((t) => t.origin === 'placeholder' && t.seed === false).length,
    counters: JSON.stringify(
      (await all('invoice-counters', { series: { in: ['RE', 'GS'] } })).map((c) => [
        c.series,
        c.year,
        c.lastNumber,
      ]),
    ),
  }
}

async function dropAdoptedPages() {
  await payload.delete({
    collection: 'pages',
    where: { seedKey: { exists: true } },
    overrideAccess: true,
    context: { seed: true, skipAudit: true },
  })
}

beforeAll(async () => {
  payload = await getTestPayload()
  // Ausgangslage: Grund-Seed, kein Beispielbestand (auch nicht aus `db:reset --seed=all`), keine Seiten mit Seed-Bezug,
  // ein echtes Stück Nr. 17 und ein echter Zähler.
  await seed('remove', { yes: true, dropTexts: true })
  await dropAdoptedPages()
  await payload.delete({
    collection: 'pages',
    where: { key: { in: ['home', 'contact'] } },
    overrideAccess: true,
    context: { seed: true, skipAudit: true },
  })
  await seed('base')
  const real = await payload.create({
    collection: 'products',
    data: {
      itemNumber: 17,
      category: 'keramik',
      title: 'Echte Schale mit Hund',
      priceCents: 3900,
      shippingClass: 'keramik',
    } as never,
    overrideAccess: true,
  })
  realProductId = real.id as number
  realProductBefore = await realProductState()
  const counter = await all('invoice-counters', {
    and: [{ series: { equals: 'RE' } }, { year: { equals: 2026 } }],
  })
  if (counter.length === 0) {
    await payload.create({
      collection: 'invoice-counters',
      data: { series: 'RE', year: 2026, lastNumber: 7 } as never,
      overrideAccess: true,
    })
  }
})

afterAll(async () => {
  await seed('remove', { yes: true, dropTexts: true })
  await dropAdoptedPages()
  await payload.delete({ collection: 'products', id: realProductId, overrideAccess: true })
})

describe('Mini-Beispielbestand (DM-P1-04, AK-11-01, AK-11-02, AK-SEED-06, AK-SEED-18)', () => {
  it('DM-P1-04/AK-11-01: zweimal seed ergibt identische Anzahlen je Collection und keine doppelten seedKeys', async () => {
    await seed('all')
    const first = await countsBySeed()
    await seed('all')
    await seed('example')
    expect(await countsBySeed()).toEqual(first)
    // Mengen nur aus SEED_EXPECTED_COUNTS (SEED-SPEC §0.1); Seiten/FAQ folgen mit P8.7, Beleg-PDFs zählen zu private-uploads
    const data = await loadSeedData({ now })
    for (const c of [
      'products',
      'checkouts',
      'orders',
      'reservations',
      'media',
      'invoices',
    ] as const) {
      expect(first[c], c).toBe(expectedCount(c))
    }
    expect(first.pages).toBe(data.pages.length)
    expect(first['private-uploads']).toBe(data.privateUploads.length + (first.invoices ?? 0))
    for (const collection of seedCollections(payload)) {
      const keys = (await all(collection, { seed: { equals: true } })).map((d) => d.seedKey)
      expect(new Set(keys).size, collection).toBe(keys.length)
    }
    const settings = (await payload.findGlobal({ slug: 'settings', overrideAccess: true })) as {
      seed?: { exampleDataPresent?: boolean; importedAt?: string }
    }
    expect(settings.seed?.exampleDataPresent).toBe(true)
    expect(settings.seed?.importedAt).toBe('2026-10-15T08:00:30.000Z')
  })

  it('AK-11-02: jedes Beispiel-Dokument hat seed = true und einen seedKey; Grund-Seed bleibt seed = false', async () => {
    for (const collection of seedCollections(payload)) {
      for (const doc of await all(collection, { seed: { equals: true } })) {
        expect(doc.seedKey, `${collection} ${String(doc.id)}`).toMatch(
          new RegExp(`^${collection}:[A-Za-z0-9:#._-]{1,80}$`),
        )
      }
    }
    const keys = (await all('products', { seed: { equals: true } })).map((p) => p.seedKey)
    expect(keys.sort()).toEqual(ALL_PRODUCTS.map((k) => `products:${k}`))
    const legal = await all('legal-texts')
    expect(legal.every((t) => t.seed === false)).toBe(true)
  })

  it('jeder ProductStatus, jede Kategorie; Nummern 9nn; S06 offline verkauft im Archiv, S09 archiviert ohne Verkaufsfelder', async () => {
    const products = await all('products', { seed: { equals: true } })
    expect(new Set(products.map((p) => p.status))).toEqual(new Set(PRODUCT_STATUSES))
    expect(new Set(products.map((p) => p.category))).toEqual(new Set(PRODUCT_CATEGORIES))
    for (const p of products) {
      expect(p.itemNumber).toBe(900 + Number(String(p.seedKey).slice('products:S'.length)))
    }
    const s06 = await product('S06')
    expect([s06.status, s06.soldChannel, s06.showInArchiveAfterSale]).toEqual([
      'sold',
      'offline',
      true,
    ])
    expect(s06.soldAt).toBe('2026-09-13T13:00:00.000Z')
    const s09 = await product('S09')
    expect(s09.status).toBe('archived')
    expect(s09.archivedAt).toBe('2026-10-09T07:35:00.000Z')
    expect([s09.soldAt ?? null, s09.soldChannel ?? null, s09.currentOrder ?? null]).toEqual([
      null,
      null,
      null,
    ])
    const s01 = (
      await payload.find({
        collection: 'products',
        where: { seedKey: { equals: 'products:S01' } },
        locale: 'en',
        depth: 1,
        overrideAccess: true,
      })
    ).docs[0] as unknown as { title: string; images: { alt: string; sourceRef: string }[] }
    expect(s01.title).toBe('Bowl “Long Ears & Fluff”')
    expect(s01.images.map((i) => i.sourceRef)).toEqual(['DdUPhoZOoMW#a', 'DdUPhoZOoMW'])
  })

  it('AK-SEED-06 (Teil): available/reserved bestehen validateForPublish; S18 scheitert genau an der Faserangabe, S25 genau an der englischen Bildbeschreibung', async () => {
    for (const p of await all('products', {
      and: [{ seed: { equals: true } }, { status: { in: ['available', 'reserved'] } }],
    })) {
      // Erneutes Speichern mit Veröffentlichungsprüfung (wie `publish`): darf nicht scheitern.
      await payload.update({
        collection: 'products',
        id: p.id as number,
        data: { status: p.status } as never,
        overrideAccess: true,
        context: { transition: 'publish' },
      })
    }
    const publishErrors = async (key: string) => {
      const p = await product(key)
      const err = await payload
        .update({
          collection: 'products',
          id: p.id as number,
          data: { status: 'available' } as never,
          overrideAccess: true,
          context: { transition: 'publish' },
        })
        .then(
          () => null,
          (e: unknown) => e as { data?: { errors?: { path: string; message: string }[] } },
        )
      return err?.data?.errors ?? []
    }
    const s18 = await publishErrors('S18')
    expect(s18.map((e) => e.path)).toEqual(['fiberComposition'])
    const s25 = await publishErrors('S25')
    expect(s25.map((e) => e.path)).toEqual(['images'])
    expect(s25[0]!.message).toMatch(/Englisch/)
    expect((await product('S18')).status).toBe('draft')
  })

  it('S27 ist reserviert, seine Kasse KS2 offen, genau eine Reservierung aktiv (Token nur als Hash)', async () => {
    const s27 = await product('S27')
    expect(s27.status).toBe('reserved')
    expect(s27.reservedUntil).toBe('2026-10-15T08:30:00.000Z')
    const [ks2] = await all('checkouts', { seedKey: { equals: 'checkouts:KS2' } })
    expect(ks2!.status).toBe('open')
    expect(ks2!.tokenHash).toBe(hashToken(seedToken('checkouts:KS2', 'checkout')))
    expect(ks2!.reservationRef).toBe(s27.reservationRef)
    expect([ks2!.subtotalCents, ks2!.shippingCents, ks2!.totalCents]).toEqual([3200, 450, 3650])
    expect(ks2!.displayExpiresAt).toBe('2026-10-15T08:24:00.000Z')
    expect(ks2!.expiresAt).toBe('2026-10-15T08:30:00.000Z')
    expect(ks2!.createdAt).toBe('2026-10-15T07:54:00.000Z')
    expect((ks2!.stripe as { livemode: boolean }).livemode).toBe(false)
    const active = await all('reservations', {
      and: [{ product: { equals: s27.id } }, { status: { equals: 'active' } }],
    })
    expect(active).toHaveLength(1)
    expect(active[0]!.source).toBe('checkout_session')
    expect(active[0]!.ref).toBe(ks2!.reservationRef)
    expect(active[0]!.checkout).toBe(ks2!.id)
  })

  it('AK-SEED-18: home hat hero + genau 7 Stationen in fester Reihenfolge; contact laut §13.3 (DE/EN)', async () => {
    const find = async (key: string, locale: 'de' | 'en') =>
      (
        await payload.find({
          collection: 'pages',
          where: { key: { equals: key } },
          locale,
          overrideAccess: true,
        })
      ).docs[0] as unknown as {
        title: string
        _status: string
        layout: { blockType: string; stationId?: string; heading?: string }[]
      }
    const home = await find('home', 'de')
    expect(home._status).toBe('published')
    expect(home.layout.map((b) => b.blockType)).toEqual(['hero', ...Array(7).fill('station')])
    expect(home.layout.slice(1).map((b) => b.stationId)).toEqual([
      'hallo',
      'keramik',
      'textil',
      'zeichnungen',
      'schmuck',
      'tattoo',
      'jutta-und-coco',
    ])
    const homeEn = await find('home', 'en')
    expect(homeEn.title).toBe('Home')
    expect(homeEn.layout[3]!.heading).toBe('Textiles & caps')
    const contact = await find('contact', 'de')
    expect(contact.layout.map((b) => b.blockType)).toEqual([
      'richText',
      'contactLinks',
      'callout',
      'faqList',
      'faqList',
    ])
  })
})

describe('Entfernen (AK-11-03, AK-SEED-14, AK-SEED-15)', () => {
  it('AK-11-03/AK-SEED-14: seed:remove --yes --drop-texts → 0 Dokumente mit seed = true, Seiten gelöscht, Grund-Seed und RE/GS-Zähler unverändert', async () => {
    const before = await baseState()
    await seed('remove', { yes: true, dropTexts: true })
    const counts = await countsBySeed()
    expect(
      Object.values(counts).every((n) => n === 0),
      JSON.stringify(counts),
    ).toBe(true)
    expect(await all('pages', { key: { in: ['home', 'contact'] } })).toHaveLength(0)
    expect(await all('checkouts')).toHaveLength(0)
    expect(await all('reservations')).toHaveLength(0)
    expect(await all('orders')).toHaveLength(0)
    expect(await all('invoice-counters', { series: { in: ['BSP-RE', 'BSP-GS'] } })).toHaveLength(0)
    expect(await baseState()).toEqual(before)
    expect((await baseState()).placeholders).toBe(LEGAL_TEXT_TYPES.length)
    const settings = (await payload.findGlobal({ slug: 'settings', overrideAccess: true })) as {
      seed?: { exampleDataPresent?: boolean }
    }
    expect(settings.seed?.exampleDataPresent).toBe(false)
    expect(
      (await all('audit-log', { action: { equals: 'seed_removed' } })).length,
    ).toBeGreaterThanOrEqual(1)
  })

  it('AK-SEED-15 (Teil): ein echtes Stück Nr. 17 bleibt bei seed, seed:remove und seed:reset unverändert', async () => {
    await seed('all')
    expect(await realProductState()).toBe(realProductBefore)
    await seed('reset')
    expect(await realProductState()).toBe(realProductBefore)
    expect((await countsBySeed()).products).toBe(expectedCount('products'))
    await seed('remove', { yes: true })
    expect(await realProductState()).toBe(realProductBefore)
  })

  it('AK-11-03/AK-SEED-14: seed:remove --yes (Texte behalten) → Seiten übernommen (seed = false), sonst 0 Dokumente mit seed = true', async () => {
    const counts = await countsBySeed()
    expect(
      Object.values(counts).every((n) => n === 0),
      JSON.stringify(counts),
    ).toBe(true)
    const pages = await all('pages', { key: { in: ['home', 'contact'] } })
    expect(pages.map((p) => [p.key, p.seed, p.seedKey]).sort()).toEqual([
      ['contact', false, 'pages:contact'],
      ['home', false, 'pages:home'],
    ])
    // Ein weiterer Seed-Lauf überspringt übernommene Seiten.
    const { report } = await seed('example')
    expect(report.get('pages', 'skipped')).toBe(2)
    expect(report.get('pages', 'created')).toBe(0)
  })
})
