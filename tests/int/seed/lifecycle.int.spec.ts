import { spawnSync } from 'node:child_process'

import type { CollectionSlug, Payload } from 'payload'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  expectedCount,
  SEED_EXPECTED_COUNTS,
  type SeedExpectedCollection,
} from '@/lib/seed/expected'
import { seedCollections, seedSummary } from '@/lib/seed/remove'
import { resolveSeedTime } from '@/lib/seed/time'

import { getTestPayload } from '../helpers/payload'
import { findAll, runCanonicalSeed, SEED_CLOCK, SEED_N, SEED_TIMEOUT } from './canonical'

// P8.9: Lebenszyklus des Beispielbestands (SEED-SPEC §1.3–§1.7, §18; DATENMODELL §13.5) – Idempotenz, Mengen,
// Kennzeichnung, Mengenvorschau ohne Schreiben, Entfernen mit/ohne Texte, Reset; Gegenprobe mit einem echten Stück
// Nr. 17, einem echten Umsatz `2026-09/tattoo` und einer echten Tattoo-Aktion, die auf Seed-Flash verweist.
// Die Produktionssperre (AK-SEED-04 Schreib-Teil) prüft `guard.int.spec.ts` über die CLI, jede Bedingung einzeln
// `tests/unit/seed/guard.unit.spec.ts`.

vi.setConfig({ testTimeout: SEED_TIMEOUT * 3, hookTimeout: SEED_TIMEOUT * 2 })

const url = process.env.DATABASE_URL_TEST!
const M1 = resolveSeedTime('M-1', { now: SEED_N }) as string
const SEQUENCES = [
  'order_number_seq', // PC
  'withdrawal_number_seq', // WR
  'inquiry_number_seq', // AA
  'privacy_request_number_seq', // DS
] as const

const NOT_SEED = { or: [{ seed: { equals: false } }, { seed: { exists: false } }] }

let payload: Payload
let client: pg.Client
let realProductId: number
let realProductBefore: string
let realRevenueBefore: string
let sequencesBefore: string

async function count(collection: CollectionSlug, where = {}): Promise<number> {
  return (await payload.count({ collection, where, overrideAccess: true })).totalDocs
}

async function seedCounts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  for (const c of seedCollections(payload)) out[c] = await count(c, { seed: { equals: true } })
  out['invoice-counters'] = await count('invoice-counters', {
    series: { in: ['BSP-RE', 'BSP-GS'] },
  })
  return out
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

async function realRevenueState(): Promise<string> {
  return JSON.stringify(
    (await findAll(payload, 'revenue-entries', NOT_SEED)).map((d) => [
      d.month,
      d.source,
      d.amountCents,
      d.updatedAt,
    ]),
  )
}

/** Echte Sequenzen (PC, WR, AA, DS) und Zähler RE/GS. */
async function sequenceState(): Promise<string> {
  const parts: string[] = []
  for (const s of SEQUENCES) {
    const r = await client.query<{ last_value: string; is_called: boolean }>(
      `SELECT last_value::text, is_called FROM "${s}"`,
    )
    parts.push(`${s}:${r.rows[0]!.last_value}:${r.rows[0]!.is_called}`)
  }
  const counters = await findAll(payload, 'invoice-counters', { series: { in: ['RE', 'GS'] } })
  parts.push(
    ...counters
      .map((c) => `${c.series}:${c.year}:${c.lastNumber}`)
      .sort((a, b) => a.localeCompare(b)),
  )
  return parts.join('|')
}

/** Fingerabdruck aller Tabellen (Zeilenzahl + jüngstes `updated_at`) – wie guard.int.spec.ts. */
async function fingerprint(): Promise<string> {
  const tables = await client.query<{ table_name: string; has_updated: boolean }>(`
    SELECT t.table_name,
           EXISTS (SELECT 1 FROM information_schema.columns c
                   WHERE c.table_schema = 'public' AND c.table_name = t.table_name
                     AND c.column_name = 'updated_at') AS has_updated
    FROM information_schema.tables t
    WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
    ORDER BY t.table_name`)
  const parts: string[] = []
  for (const t of tables.rows) {
    const q = t.has_updated
      ? `SELECT count(*)::int AS n, max(updated_at)::text AS u FROM "${t.table_name}"`
      : `SELECT count(*)::int AS n, NULL AS u FROM "${t.table_name}"`
    const r = await client.query<{ n: number; u: string | null }>(q)
    parts.push(`${t.table_name}:${r.rows[0]!.n}:${r.rows[0]!.u ?? ''}`)
  }
  return parts.join('|')
}

async function dropAdoptedTexts() {
  for (const collection of ['pages', 'faqs'] as const) {
    await payload.delete({
      collection,
      where: { seedKey: { exists: true } },
      overrideAccess: true,
      context: { seed: true, skipAudit: true },
    })
  }
}

beforeAll(async () => {
  payload = await getTestPayload()
  client = new pg.Client({ connectionString: url })
  await client.connect()
  // Ausgangslage: Grund-Seed, kein Beispielbestand, ein echtes Stück Nr. 17, echte Sequenzen mit Wert.
  await runCanonicalSeed(payload, 'remove', { yes: true, dropTexts: true })
  await dropAdoptedTexts()
  await runCanonicalSeed(payload, 'base')
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
  for (const s of SEQUENCES) await client.query(`SELECT nextval('"${s}"')`)
  if ((await count('invoice-counters', { series: { equals: 'RE' } })) === 0) {
    await payload.create({
      collection: 'invoice-counters',
      data: { series: 'RE', year: 2026, lastNumber: 7 } as never,
      overrideAccess: true,
    })
  }
  sequencesBefore = await sequenceState()
})

afterAll(async () => {
  await runCanonicalSeed(payload, 'remove', { yes: true, dropTexts: true })
  await dropAdoptedTexts()
  await payload.delete({
    collection: 'tattoo-offers',
    where: { title: { equals: 'Echte Aktion mit Seed-Flash' } },
    overrideAccess: true,
  })
  await payload.delete({ collection: 'revenue-entries', where: {}, overrideAccess: true })
  await payload.delete({ collection: 'products', id: realProductId, overrideAccess: true })
  await client.end()
})

describe('Seed-Lebenszyklus (AK-SEED-01, -02, -03, -14, -15; AK-11-01, AK-11-02)', () => {
  it('AK-SEED-03/AK-SEED-02/AK-11-02: seed:reset mit kanonischem N → Mengen = SEED_EXPECTED_COUNTS, jedes Beispiel-Dokument seed = true mit seedKey, Grund-Seed seed = false; settings.seed gesetzt', async () => {
    await runCanonicalSeed(payload, 'reset')
    const counts = await seedCounts()
    for (const [collection, n] of Object.entries(counts)) {
      if (!(collection in SEED_EXPECTED_COUNTS)) continue
      const exp = SEED_EXPECTED_COUNTS[collection as SeedExpectedCollection]
      // Grund-Seed-Collections zählen hier nur Seed-Dokumente (keine).
      if (['categories', 'legal-texts', 'site-texts', 'settings', 'users'].includes(collection)) {
        expect(n, collection).toBe(0)
        continue
      }
      expect(n, collection).toBe(typeof exp === 'number' ? exp : exp.max)
    }
    // Jede in §0.1 genannte Seed-Collection ist auch wirklich gezählt worden.
    for (const c of [
      'media',
      'products',
      'checkouts',
      'orders',
      'reservations',
      'invoices',
    ] as const) {
      expect(counts[c], c).toBe(expectedCount(c))
    }

    // AK-SEED-02: In Collections mit Seed-Kennzeichnung ist alles außer den echten Gegenproben seed = true mit seedKey.
    for (const c of seedCollections(payload)) {
      const seeded = await findAll(payload, c, { seed: { equals: true } })
      expect(
        seeded.filter((d) => typeof d.seedKey !== 'string' || !d.seedKey.startsWith(`${c}:`)),
        c,
      ).toEqual([])
      const real = await findAll(payload, c, NOT_SEED)
      const allowed: Record<string, number> = {
        products: 1, // echtes Stück Nr. 17
        'legal-texts': SEED_EXPECTED_COUNTS['legal-texts'],
        categories: SEED_EXPECTED_COUNTS.categories,
        // PDFs der Platzhalter-Rechtstexte (Grund-Seed, seed = false)
        documents: SEED_EXPECTED_COUNTS['legal-texts'],
      }
      // audit-log: echte Einträge (z. B. seed_removed, Anlage des echten Stücks) sind keine Seed-Dokumente.
      if (c === 'audit-log') {
        expect(real.every((d) => d.seedKey == null)).toBe(true)
        continue
      }
      expect(real.length, c).toBeLessThanOrEqual(allowed[c] ?? 0)
      expect(real.every((d) => d.seedKey == null, c)).toBe(true)
    }
    // Grund-Seed (ohne Seed-Kennzeichnung bzw. seed = false) bleibt in der Menge aus §0.1.
    for (const c of ['categories', 'legal-texts'] as const) {
      if (seedCollections(payload).includes(c)) {
        expect(await count(c, { seed: { equals: true } }), c).toBe(0)
      }
      expect(await count(c), c).toBe(expectedCount(c))
    }

    const settings = (await payload.findGlobal({ slug: 'settings', overrideAccess: true })) as {
      seed?: { exampleDataPresent?: boolean; importedAt?: string }
    }
    expect(settings.seed?.exampleDataPresent).toBe(true)
    expect(settings.seed?.importedAt).toBe(SEED_CLOCK.now().toISOString())
    expect(await count('audit-log', { action: { equals: 'seed_imported' } })).toBe(1)
    // Echte Sequenzen und Zähler RE/GS werden vom Seed nie belegt.
    expect(await sequenceState()).toBe(sequencesBefore)
    expect(await realProductState()).toBe(realProductBefore)
  })

  it('AK-SEED-01/AK-11-01: ein zweiter Lauf von pnpm seed ändert keine Anzahl und erzeugt keine doppelten seedKeys', async () => {
    const before = await seedCounts()
    const { report } = await runCanonicalSeed(payload, 'all')
    expect(await seedCounts()).toEqual(before)
    for (const c of seedCollections(payload)) {
      expect(report.get(c, 'created'), c).toBe(0)
      const dup = await client.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM (SELECT seed_key FROM "${c.replace(/-/g, '_')}"
           WHERE seed_key IS NOT NULL GROUP BY seed_key HAVING count(*) > 1) d`,
      )
      expect(dup.rows[0]!.n, c).toBe(0)
    }
    expect(await sequenceState()).toBe(sequencesBefore)
  })

  it('AK-SEED-15: echtes Stück Nr. 17 und echter Umsatz 2026-09/tattoo bleiben bei seed unverändert; der Seed überspringt das belegte Paar', async () => {
    expect(M1).toBe('2026-09')
    await payload.create({
      collection: 'revenue-entries',
      data: { month: M1, source: 'tattoo', amountCents: 123400 },
      overrideAccess: true,
    })
    realRevenueBefore = await realRevenueState()
    expect(JSON.parse(realRevenueBefore)).toHaveLength(1)
    const { report } = await runCanonicalSeed(payload, 'all')
    expect(report.get('revenue-entries', 'skipped')).toBe(1)
    expect(await count('revenue-entries', { seed: { equals: true } })).toBe(
      expectedCount('revenue-entries') - 1,
    )
    expect(await realRevenueState()).toBe(realRevenueBefore)
    expect(await realProductState()).toBe(realProductBefore)
  })

  it('seed:remove ohne --yes schreibt nichts und zeigt die Mengen je Collection (CLI)', async () => {
    const summary = await seedSummary(payload)
    expect(summary.products).toBe(expectedCount('products'))
    expect(summary['invoice-counters']).toBe(2)
    const before = await fingerprint()
    const res = spawnSync('pnpm', ['-s', 'seed:remove'], {
      env: { ...process.env, APP_ENV: 'test', DATABASE_URL: url, DATABASE_URL_UNPOOLED: url },
      encoding: 'utf8',
      timeout: 180_000,
    })
    expect(res.status, res.stderr).toBe(0)
    expect(res.stdout).toContain('Vorschau')
    for (const [c, n] of Object.entries(summary)) expect(res.stdout).toContain(`${c}: ${n}`)
    expect(await fingerprint()).toBe(before)
  })

  it('AK-SEED-14/AK-SEED-15: seed:remove --yes → 0 Dokumente mit seed = true, keine BSP-Zähler, Seiten/FAQ übernommen, Sequenzen und echte Daten unverändert; Verweise echter Dokumente im Bericht', async () => {
    const flashes = await findAll(payload, 'flash', {
      seedKey: { in: ['flash:F902', 'flash:F906'] },
    })
    expect(flashes).toHaveLength(2)
    const offer = await payload.create({
      collection: 'tattoo-offers',
      data: {
        type: 'aktion',
        title: 'Echte Aktion mit Seed-Flash',
        description: 'Gegenprobe: echte Aktion, die auf Beispiel-Flash verweist.',
        startsAt: '2026-11-07T11:00:00.000Z',
        endsAt: '2026-11-07T18:00:00.000Z',
        flashes: flashes.map((f) => f.id),
        published: false,
      } as never,
      overrideAccess: true,
    })

    const { report } = await runCanonicalSeed(payload, 'remove', { yes: true })
    const counts = await seedCounts()
    expect(
      Object.entries(counts).filter(([, n]) => n > 0),
      JSON.stringify(counts),
    ).toEqual([])
    expect(await count('pages', { seed: { equals: false }, seedKey: { exists: true } })).toBe(
      expectedCount('pages'),
    )
    expect(await count('faqs', { seed: { equals: false }, seedKey: { exists: true } })).toBe(
      expectedCount('faqs'),
    )
    // G1/G2 (Kund:innen ohne Einwilligung) werden immer gelöscht – wie die ganze Seed-Galerie.
    expect(await count('tattoo-gallery', { seedKey: { exists: true } })).toBe(0)
    // Reklamationen und Datenschutz-Anfragen nie übernommen.
    expect(await count('complaints')).toBe(0)
    expect(await count('privacy-requests')).toBe(0)
    expect(await count('checkouts')).toBe(0)

    // Verweis der echten Aktion auf Seed-Flash: entfernt und im Bericht gelistet.
    const after = await payload.findByID({
      collection: 'tattoo-offers',
      id: offer.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(after.flashes ?? []).toEqual([])
    expect(report.get('tattoo-offers', 'unlinked')).toBe(2)
    expect(report.notes).toContain(
      `Verweis entfernt: tattoo-offers ${offer.id} „Echte Aktion mit Seed-Flash“ (flashes) → flash:F902`,
    )

    const settings = (await payload.findGlobal({ slug: 'settings', overrideAccess: true })) as {
      seed?: { exampleDataPresent?: boolean }
    }
    expect(settings.seed?.exampleDataPresent).toBe(false)
    expect(await sequenceState()).toBe(sequencesBefore)
    expect(await realProductState()).toBe(realProductBefore)
    expect(await realRevenueState()).toBe(realRevenueBefore)
    expect(await count('legal-texts', { origin: { equals: 'placeholder' } })).toBe(
      expectedCount('legal-texts'),
    )
  })

  it('AK-SEED-14/AK-SEED-15: seed:reset und seed:remove --yes --drop-texts → Seiten/FAQ gelöscht, echte Daten und Sequenzen unverändert', async () => {
    await dropAdoptedTexts()
    await runCanonicalSeed(payload, 'reset')
    expect(await count('pages', { seed: { equals: true } })).toBe(expectedCount('pages'))
    expect(await realProductState()).toBe(realProductBefore)
    expect(await realRevenueState()).toBe(realRevenueBefore)
    await runCanonicalSeed(payload, 'remove', { yes: true, dropTexts: true })
    const counts = await seedCounts()
    expect(
      Object.entries(counts).filter(([, n]) => n > 0),
      JSON.stringify(counts),
    ).toEqual([])
    expect(await count('pages', { seedKey: { exists: true } })).toBe(0)
    expect(await count('faqs', { seedKey: { exists: true } })).toBe(0)
    expect(await sequenceState()).toBe(sequencesBefore)
    expect(await realProductState()).toBe(realProductBefore)
    expect(await realRevenueState()).toBe(realRevenueBefore)
  })

  it('AK-SEED-04 (Teil): seed:base läuft mit APP_ENV=production und überschreibt keinen vorhandenen Wert', async () => {
    await payload.updateGlobal({
      slug: 'settings',
      data: { business: { email: 'jutta@example.org' } } as never,
      overrideAccess: true,
      context: { skipAudit: true },
    })
    const settingsState = async () => {
      const { updatedAt: _u, ...rest } = (await payload.findGlobal({
        slug: 'settings',
        depth: 0,
        overrideAccess: true,
      })) as unknown as Record<string, unknown>
      return JSON.stringify(rest)
    }
    const before = await settingsState()
    const categories = await count('categories')
    const { report } = await runCanonicalSeed(payload, 'base', { appEnv: 'production' })
    expect(report.lines().join('\n')).toContain('kein Admin-Konto in Produktion')
    expect(await settingsState()).toBe(before)
    expect(await count('categories')).toBe(categories)
    // Alle übrigen Befehle sind in Produktion gesperrt – auch über die Bibliothek.
    for (const command of ['all', 'example', 'remove', 'reset'] as const) {
      await expect(
        runCanonicalSeed(payload, command, { appEnv: 'production', yes: true }),
      ).rejects.toThrow(/APP_ENV=production/)
    }
  })
})
