import type { Payload } from 'payload'
import { unzipSync } from 'fflate'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { resetEnvCache, seedPreviewModeActive } from '@/lib/env'
import { buildDatevExport } from '@/lib/export/datev'
import { buildInvoiceZip } from '@/lib/export/invoiceZip'
import { buildMonthlyCsv } from '@/lib/export/monthlyCsv'
import { buildPackagingReport } from '@/lib/export/packagingReport'
import { getRevenueStatus } from '@/lib/revenue/check'
import { expectedCount } from '@/lib/seed/expected'
import { loadSeedData } from '@/lib/seed/loader'
import { resolveSeedTime } from '@/lib/seed/time'

import { getTestPayload } from '../helpers/payload'
import { SEED_N, SEED_TIMEOUT, findAll, runCanonicalSeed } from './canonical'

// P8.5: Umsätze M-9…M-1 (SEED-SPEC §15) – Umsatz-Wächter „im grünen Bereich“ nur mit wirksamem SEED_PREVIEW_MODE,
// ein echter Eintrag verdrängt den Seed-Eintrag gleicher (Monat, Quelle) (DATENMODELL §6.20), der Seed überspringt
// belegte Paare (§1.3), AK-SEED-15 (Umsatz-Teil) und AK-SEED-21 (Exporte ohne Beispieldaten, R-124).

let payload: Payload
const M1 = resolveSeedTime('M-1', { now: SEED_N }) as string
const MONTHS = ['M-3', 'M-2', 'M-1'].map((m) => resolveSeedTime(m, { now: SEED_N }) as string)

async function realEntry(month: string, source: string) {
  const res = await payload.find({
    collection: 'revenue-entries',
    where: { and: [{ month: { equals: month } }, { source: { equals: source } }] },
    overrideAccess: true,
    depth: 0,
  })
  return res.docs.map((d) => [d.month, d.source, d.amountCents, d.seed ?? false] as const)
}

async function withPreview<T>(fn: () => Promise<T>, appEnv = 'preview'): Promise<T> {
  vi.stubEnv('SEED_PREVIEW_MODE', 'true')
  vi.stubEnv('APP_ENV', appEnv)
  resetEnvCache()
  try {
    return await fn()
  } finally {
    vi.unstubAllEnvs()
    resetEnvCache()
  }
}

beforeAll(async () => {
  payload = await getTestPayload()
  await runCanonicalSeed(payload)
}, SEED_TIMEOUT)

afterAll(async () => {
  await payload.delete({
    collection: 'revenue-entries',
    where: { seed: { not_equals: true } },
    overrideAccess: true,
    context: { seed: true },
  })
  await runCanonicalSeed(payload, 'remove', { yes: true, dropTexts: true })
}, SEED_TIMEOUT)

describe('Umsätze (SEED-SPEC §15)', () => {
  it('18 Einträge (9 Monate × Tattoo/Flohmarkt) mit Summen laut §15', async () => {
    const entries = await findAll(payload, 'revenue-entries', { seed: { equals: true } })
    expect(entries).toHaveLength(expectedCount('revenue-entries'))
    const sum = (source: string) =>
      entries.filter((e) => e.source === source).reduce((s, e) => s + Number(e.amountCents), 0)
    expect([sum('tattoo'), sum('flohmarkt')]).toEqual([990000, 308000])
    expect(new Set(entries.map((e) => e.month)).size).toBe(9)
    expect(entries.map((e) => e.month).sort()[0]).toBe('2026-01')
    expect(
      entries
        .map((e) => e.month)
        .sort()
        .at(-1),
    ).toBe(M1)
    expect(entries.filter((e) => e.note === 'Winterpause').map((e) => [e.month, e.source])).toEqual(
      expect.arrayContaining([
        ['2026-01', 'flohmarkt'],
        ['2026-02', 'flohmarkt'],
      ]),
    )
  })

  it('Umsatz-Wächter: mit wirksamem SEED_PREVIEW_MODE „im grünen Bereich“ (< 80 % von 25 000 €); ohne zählen Seed-Umsätze nicht', async () => {
    const preview = await withPreview(async () => {
      expect(seedPreviewModeActive()).toBe(true)
      return getRevenueStatus(payload, SEED_N)
    })
    expect(preview.totalCents).toBeGreaterThan(1_200_000)
    expect(preview.totalCents).toBeLessThan(2_000_000)
    expect(preview.current).toBeNull()
    vi.stubEnv('SEED_PREVIEW_MODE', 'false')
    resetEnvCache()
    try {
      const real = await getRevenueStatus(payload, SEED_N)
      expect([real.totalCents, real.shopCents, real.manualCents]).toEqual([0, 0, 0])
    } finally {
      vi.unstubAllEnvs()
      resetEnvCache()
    }
    // Produktion: nie mitzählen, auch mit SEED_PREVIEW_MODE=true
    const prod = await withPreview(() => getRevenueStatus(payload, SEED_N), 'production')
    expect(prod.totalCents).toBe(0)
  })

  it('AK-SEED-21 / AK-11-05: Monats-CSV, DATEV-Export, Rechnungs-ZIP und Verpackungs-CSV enthalten keine Beispieldaten – auch mit SEED_PREVIEW_MODE', async () => {
    await payload.updateGlobal({
      slug: 'settings',
      data: {
        export: {
          datev: {
            consultantNumber: '1234567',
            clientNumber: '10001',
            fiscalYearStart: '01-01',
            revenueAccount: '8195',
            stripeTransitAccount: '1361',
            bankAccount: '1200',
            feeAccount: '4970',
          },
        },
      } as never,
      overrideAccess: true,
      context: { seed: true, skipAudit: true },
    })
    await withPreview(async () => {
      for (const month of [...MONTHS, '2026-10']) {
        const csv = await buildMonthlyCsv(payload, month)
        expect(csv.documents, month).toHaveLength(0)
        expect(csv.bytes.toString('utf8')).not.toMatch(/BSP-|PC-2026-900/)
        const zip = await buildInvoiceZip(payload, month)
        const files = Object.keys(unzipSync(new Uint8Array(zip.bytes)))
        expect(files, month).toEqual([csv.filename])
        const datev = await buildDatevExport(payload, month)
        expect(datev.bookings, month).toHaveLength(0)
        expect(datev.bytes.toString('latin1')).not.toMatch(/BSP-|PC-2026-900/)
      }
      const packaging = await buildPackagingReport(payload, 2026)
      expect(packaging.totals.shipments).toBe(0)
      expect(packaging.bytes.toString('utf8')).not.toMatch(/SEED|PC-2026-900/)
    })
  })

  it(
    'DATENMODELL §6.20 + AK-SEED-15 (Umsatz-Teil): echter Eintrag verdrängt den Seed-Eintrag; seed, seed:remove und seed:reset lassen ihn unverändert; der Seed überspringt das belegte Paar',
    async () => {
      expect(await realEntry(M1, 'tattoo')).toEqual([[M1, 'tattoo', 141000, true]])
      await payload.create({
        collection: 'revenue-entries',
        data: { month: M1, source: 'tattoo', amountCents: 123400 },
        overrideAccess: true,
      })
      const real = [[M1, 'tattoo', 123400, false]]
      expect(await realEntry(M1, 'tattoo')).toEqual(real)

      const { report } = await runCanonicalSeed(payload, 'all')
      expect(report.get('revenue-entries', 'skipped')).toBe(1)
      expect(report.get('revenue-entries', 'created')).toBe(0)
      expect(await realEntry(M1, 'tattoo')).toEqual(real)
      expect(await findAll(payload, 'revenue-entries', { seed: { equals: true } })).toHaveLength(
        expectedCount('revenue-entries') - 1,
      )

      await runCanonicalSeed(payload, 'remove', { yes: true })
      expect(await realEntry(M1, 'tattoo')).toEqual(real)
      await runCanonicalSeed(payload, 'reset')
      expect(await realEntry(M1, 'tattoo')).toEqual(real)
      expect(await findAll(payload, 'revenue-entries', { seed: { equals: true } })).toHaveLength(
        expectedCount('revenue-entries') - 1,
      )
    },
    SEED_TIMEOUT * 2,
  )

  it('Datei revenue.json: Monate M-9 … M-1, je Monat Tattoo und Flohmarkt', async () => {
    const data = await loadSeedData({ now: SEED_N })
    expect(data.revenue.map((r) => `${r.month}:${r.source}`).sort()).toEqual(
      [9, 8, 7, 6, 5, 4, 3, 2, 1].flatMap((k) => [`M-${k}:flohmarkt`, `M-${k}:tattoo`]).sort(),
    )
  })
})
