import type { CollectionSlug, Payload } from 'payload'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { LEGAL_TEXT_TYPES } from '@/lib/enums'
import { seedCollections, seedSummary } from '@/lib/seed/remove'

import { resetAdmin } from '../helpers/admin'
import { getTestPayload } from '../helpers/payload'
import { rest } from '../helpers/rest'
import { bySeedKey, findAll, runCanonicalSeed, SEED_TIMEOUT } from './canonical'

// P8.19: Verwaltung „Beispieldaten“ – `GET /api/admin/seed/summary`, `POST /api/admin/seed/remove` (Sperre mit
// Platzhalter-Rechtstexten, Bestätigungswort, AK-11-03/R-180) und „Übernehmen“ (`POST /api/<collection>/:id/adopt`) für
// `products`, `flash`, `tattoo-gallery`, `media` (DATENMODELL §13.4/§13.5, KONZEPT §11.3).

vi.setConfig({ testTimeout: SEED_TIMEOUT, hookTimeout: SEED_TIMEOUT * 2 })

const url = process.env.DATABASE_URL_TEST!
let payload: Payload
let client: pg.Client
let token: string
let realProductId: number
let realProductBefore: string
let sequencesBefore: string

const auth = () => ({ authorization: `JWT ${token}` })
const summary = (withAuth = true) =>
  rest('GET', '/admin/seed/summary', undefined, withAuth ? auth() : {})
const remove = (body: Record<string, unknown>, withAuth = true) =>
  rest('POST', '/admin/seed/remove', body, withAuth ? auth() : {})
const adopt = (collection: CollectionSlug, id: number, withAuth = true) =>
  rest('POST', `/${collection}/${id}/adopt`, {}, withAuth ? auth() : {})

async function seedTotal(): Promise<number> {
  let n = 0
  for (const c of seedCollections(payload)) {
    n += (
      await payload.count({
        collection: c,
        where: { seed: { equals: true } },
        overrideAccess: true,
      })
    ).totalDocs
  }
  return n
}

async function sequenceState(): Promise<string> {
  const parts: string[] = []
  for (const s of ['order_number_seq', 'withdrawal_number_seq', 'inquiry_number_seq']) {
    const r = await client.query<{ last_value: string; is_called: boolean }>(
      `SELECT last_value::text, is_called FROM "${s}"`,
    )
    parts.push(`${s}:${r.rows[0]!.last_value}:${r.rows[0]!.is_called}`)
  }
  const counters = await findAll(payload, 'invoice-counters', { series: { in: ['RE', 'GS'] } })
  parts.push(...counters.map((c) => `${c.series}:${c.year}:${c.lastNumber}`).sort())
  return parts.join('|')
}

async function realProductState(): Promise<string> {
  return JSON.stringify(
    await payload.findByID({
      collection: 'products',
      id: realProductId,
      depth: 0,
      overrideAccess: true,
    }),
  )
}

/** Test-Fixture „Kanzleitexte eingesetzt“: aktive Fassungen sind keine Platzhalter mehr (bzw. wieder Platzhalter). */
async function setLegalOrigin(origin: 'lawyer' | 'placeholder') {
  await client.query(
    `UPDATE legal_texts SET origin = $1, is_placeholder = $2 WHERE status = 'active'`,
    [origin, origin === 'placeholder'],
  )
}

beforeAll(async () => {
  payload = await getTestPayload()
  client = new pg.Client({ connectionString: url })
  await client.connect()
  await runCanonicalSeed(payload, 'reset')
  token = (await resetAdmin(payload, '198.51.100.81')).token
  const real = await payload.create({
    collection: 'products',
    data: {
      itemNumber: 18,
      category: 'keramik',
      title: 'Echte Tasse mit Katze',
      priceCents: 2900,
      shippingClass: 'keramik',
    } as never,
    overrideAccess: true,
  })
  realProductId = real.id as number
  realProductBefore = await realProductState()
  for (const s of ['order_number_seq', 'withdrawal_number_seq', 'inquiry_number_seq'])
    await client.query(`SELECT nextval('"${s}"')`)
  sequencesBefore = await sequenceState()
})

afterAll(async () => {
  await setLegalOrigin('placeholder')
  await runCanonicalSeed(payload, 'remove', { yes: true, dropTexts: true })
  for (const collection of [
    'pages',
    'faqs',
    'products',
    'flash',
    'tattoo-gallery',
    'media',
  ] as const) {
    await payload.delete({
      collection,
      where: { seedKey: { exists: true } },
      overrideAccess: true,
      context: { seed: true, skipAudit: true },
    })
  }
  await payload.delete({ collection: 'products', id: realProductId, overrideAccess: true })
  await client.end()
})

describe('P8.19 Beispieldaten in der Verwaltung', () => {
  it('P8.19 ohne Admin-Sitzung → 403 für summary, remove und adopt; nichts geändert', async () => {
    const before = await seedTotal()
    expect((await summary(false)).status).toBe(403)
    expect((await remove({ confirm: 'ENTFERNEN' }, false)).status).toBe(403)
    const s02 = await bySeedKey(payload, 'products', 'S02')
    expect((await adopt('products', s02.id, false)).status).toBe(403)
    expect(await seedTotal()).toBe(before)
  })

  it('P8.19 summary: Anzahl seed = true je Collection wie seedSummary; gesperrt mit Platzhalter-Rechtstexten (alle sechs Typen)', async () => {
    const res = await summary()
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toContain('no-store')
    const body = (await res.json()) as {
      counts: Record<string, number>
      total: number
      locked: string[]
    }
    expect(body.counts).toEqual(await seedSummary(payload))
    expect(body.counts.products).toBeGreaterThan(0)
    expect(body.total).toBe(Object.values(body.counts).reduce((a, b) => a + b, 0))
    expect([...body.locked].sort()).toEqual([...LEGAL_TEXT_TYPES].sort())
  })

  it('P8.19 falsches Bestätigungswort → 400 ohne Wirkung; Sperre (R-002) → 409 mit Typen, ohne Wirkung', async () => {
    const before = await seedTotal()
    const wrong = await remove({ confirm: 'entfernen' })
    expect(wrong.status).toBe(400)
    expect(((await wrong.json()) as { error: string }).error).toContain('ENTFERNEN')
    expect((await remove({})).status).toBe(400)
    expect(await seedTotal()).toBe(before)

    const locked = await remove({ confirm: 'ENTFERNEN' })
    expect(locked.status).toBe(409)
    const body = (await locked.json()) as { error: string; lockedTypes: string[] }
    expect(body.error).toContain('Bitte zuerst die Texte der Kanzlei einsetzen')
    expect(body.lockedTypes.length).toBe(6)
    expect(await seedTotal()).toBe(before)
  })

  it('P8.19 Sperre löst sich erst, wenn alle sechs Typen eine aktive Nicht-Platzhalter-Fassung haben (Fixture)', async () => {
    await setLegalOrigin('lawyer')
    await client.query(
      `UPDATE legal_texts SET origin = 'placeholder', is_placeholder = true WHERE status = 'active' AND type = 'impressum'`,
    )
    let body = (await (await summary()).json()) as { locked: string[] }
    expect(body.locked).toEqual(['impressum'])
    await setLegalOrigin('lawyer')
    body = (await (await summary()).json()) as { locked: string[] }
    expect(body.locked).toEqual([])
  })

  it('P8.19 Übernehmen (DATENMODELL §13.4): Stück mit Bildern, Flash, Galerie-Eintrag, Bild → seed = false, Audit product_adopted; zweites Mal 409', async () => {
    const s02 = await bySeedKey(payload, 'products', 'S02')
    const res = await adopt('products', s02.id)
    expect(res.status).toBe(200)
    const product = await payload.findByID({
      collection: 'products',
      id: s02.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(product.seed).toBe(false)
    expect(product.seedKey).toBe('products:S02')
    const imageIds = (product.images ?? []).map((i) => (typeof i === 'object' ? i.id : i))
    expect(imageIds.length).toBeGreaterThan(0)
    for (const id of imageIds) {
      const m = await payload.findByID({ collection: 'media', id, depth: 0, overrideAccess: true })
      expect(m.seed, `media ${id}`).toBe(false)
    }
    expect((await adopt('products', s02.id)).status).toBe(409)

    const flash = await bySeedKey(payload, 'flash', 'F901')
    expect((await adopt('flash', flash.id)).status).toBe(200)
    expect((await adopt('flash', flash.id)).status).toBe(409)
    const gallery = await bySeedKey(payload, 'tattoo-gallery', 'G3')
    expect((await adopt('tattoo-gallery', gallery.id)).status).toBe(200)
    const [media] = await findAll(payload, 'media', { seed: { equals: true } })
    expect((await adopt('media', media!.id)).status).toBe(200)

    for (const [collection, id] of [
      ['products', s02.id],
      ['flash', flash.id],
      ['tattoo-gallery', gallery.id],
      ['media', media!.id],
    ] as const) {
      const doc = await payload.findByID({ collection, id, depth: 0, overrideAccess: true })
      expect(doc.seed, collection).toBe(false)
      const audit = await payload.find({
        collection: 'audit-log',
        where: {
          and: [
            { action: { equals: 'product_adopted' } },
            { entityCollection: { equals: collection } },
            { entityId: { equals: String(id) } },
          ],
        },
        overrideAccess: true,
      })
      expect(audit.totalDocs, collection).toBe(1)
    }
  })

  it('AK-11-03/R-180: remove → 0 Dokumente mit seed = true, echte Dokumente/Zähler unverändert, Übernommenes bleibt; settings.seed.exampleDataPresent = false; Audit seed_removed; zweimal ausführbar', async () => {
    const res = await remove({ confirm: 'ENTFERNEN', keepTexts: true })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      counts: Record<string, { deleted: number; adopted: number }>
    }
    expect(body.counts.products?.deleted).toBeGreaterThan(0)
    expect(body.counts.pages?.adopted).toBeGreaterThan(0)
    expect(await seedTotal()).toBe(0)
    expect(await seedSummary(payload)).toEqual({})
    expect(await realProductState()).toBe(realProductBefore)
    expect(await sequenceState()).toBe(sequencesBefore)
    // Übernommene Beispiele und Texte bleiben (keepTexts)
    expect((await bySeedKey(payload, 'products', 'S02')).seed).toBe(false)
    expect((await bySeedKey(payload, 'flash', 'F901')).seed).toBe(false)
    expect((await bySeedKey(payload, 'pages', 'home')).seed).toBe(false)
    const settings = await payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true })
    expect(settings.seed?.exampleDataPresent).toBe(false)
    const audit = await payload.find({
      collection: 'audit-log',
      where: { action: { equals: 'seed_removed' } },
      overrideAccess: true,
    })
    expect(audit.totalDocs).toBeGreaterThanOrEqual(1)
    expect(audit.docs[0]!.summary).toContain('Texte behalten')

    const again = await remove({ confirm: 'ENTFERNEN' })
    expect(again.status).toBe(200)
    expect(((await again.json()) as { unchanged: boolean }).unchanged).toBe(true)
    expect(await seedTotal()).toBe(0)
    const s = (await (await summary()).json()) as { total: number }
    expect(s.total).toBe(0)
  })
})
