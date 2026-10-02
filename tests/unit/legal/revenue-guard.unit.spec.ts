import { describe, expect, it } from 'vitest'

import {
  computeRevenueStatus as compute,
  DEFAULT_REVENUE_THRESHOLDS,
  parseLastNotified,
  reachedStages,
  stageMessage as rawStageMessage,
  thresholdsFromSettings,
  withNotified,
  type InvoiceMonthSum,
  type RevenueEntrySum,
} from '@/lib/revenue/guard'

// P5.23 – Umsatz-Wächter (KONZEPT §8.4, R-125, AK-8-04): reine Rechnung ohne Datenbank.

/** Intl setzt ein geschütztes Leerzeichen vor „€“. */
const stageMessage = (...a: Parameters<typeof rawStageMessage>) =>
  rawStageMessage(...a).replace(/\u00a0/g, ' ')

const NOW = new Date('2026-10-14T08:00:00.000Z')
const euro = (e: number) => Math.round(e * 100)
const stagesAt = (e: number, prev = 0) => reachedStages(euro(e), euro(prev)).map((s) => s.stage)

const inv = (month: string, grossCents: number, seed = false): InvoiceMonthSum => ({
  month,
  type: 'invoice',
  seed,
  grossCents,
})
const credit = (month: string, grossCents: number): InvoiceMonthSum => ({
  month,
  type: 'credit_note',
  seed: false,
  grossCents,
})
const entry = (
  month: string,
  source: RevenueEntrySum['source'],
  amountCents: number,
  seed = false,
): RevenueEntrySum => ({ month, source, seed, amountCents })

describe('R-125 Stufen (AK-8-04)', () => {
  it('R-125 19.999 € keine Stufe, 20.000 € U1, 25.000 € noch nicht U2, 25.001 € U2', () => {
    expect(stagesAt(19_999)).toEqual([])
    expect(stagesAt(19_999.99)).toEqual([])
    expect(stagesAt(20_000)).toEqual(['U1'])
    expect(stagesAt(25_000)).toEqual(['U1'])
    expect(stagesAt(25_000.01)).toEqual(['U1', 'U2'])
    expect(stagesAt(25_001)).toEqual(['U1', 'U2'])
  })

  it('R-125 80.000 € U3, 90.000 € U3a, 95.000 € U4, 100.000 € noch nicht U5, 100.001 € U5', () => {
    expect(stagesAt(79_999.99)).toEqual(['U1', 'U2'])
    expect(stagesAt(80_000)).toEqual(['U1', 'U2', 'U3'])
    expect(stagesAt(90_000)).toEqual(['U1', 'U2', 'U3', 'U3a'])
    expect(stagesAt(95_000)).toEqual(['U1', 'U2', 'U3', 'U3a', 'U4'])
    expect(stagesAt(100_000)).toEqual(['U1', 'U2', 'U3', 'U3a', 'U4'])
    expect(stagesAt(100_001)).toEqual(['U1', 'U2', 'U3', 'U3a', 'U4', 'U5'])
  })

  it('R-125 U0: Vorjahr > 25.000 € (genau 25.000 € nicht)', () => {
    expect(stagesAt(0, 25_000)).toEqual([])
    expect(stagesAt(0, 25_000.01)).toEqual(['U0'])
    expect(stagesAt(20_000, 30_000)).toEqual(['U0', 'U1'])
  })

  it('R-125 Schwellen aus settings.revenueGuard (Zahlen oder Texte aus der DB), fehlende → Standard', () => {
    expect(thresholdsFromSettings(null)).toEqual(DEFAULT_REVENUE_THRESHOLDS)
    const t = thresholdsFromSettings({
      previousYearLimitCents: '3000000',
      currentYearLimitCents: 12_000_000,
      stageThresholdsCents: { u1: 2_400_000, u3: null },
    })
    expect(t).toMatchObject({
      u1Cents: 2_400_000,
      previousYearLimitCents: 3_000_000,
      u3Cents: DEFAULT_REVENUE_THRESHOLDS.u3Cents,
      currentYearLimitCents: 12_000_000,
    })
    expect(reachedStages(2_400_000, 0, t).map((s) => s.stage)).toEqual(['U1'])
  })
})

describe('R-125 computeRevenueStatus', () => {
  it('R-125 Shop = Rechnungen − Gutschriften nach Belegmonat, plus manuelle Monatssummen aller Quellen und Jahressummen vor dem Shop', () => {
    const s = compute({
      year: 2026,
      now: NOW,
      invoices: [inv('2026-10', 10_000), credit('2026-10', 2_500), inv('2025-12', 99_999)],
      entries: [
        entry('2026-09', 'tattoo', 50_000),
        entry('2026-09', 'flohmarkt', 1_000),
        entry('2026-10', 'auftragsarbeiten', 7_000),
        entry('2026-10', 'sonstiges', 500),
        entry('2025-11', 'tattoo', 1),
      ],
      manualYearTotals: [
        { year: 2026, amountCents: 100_000 },
        { year: 2025, amountCents: 2_000_000 },
      ],
      includeSeed: false,
    })
    expect(s.shopCents).toBe(7_500)
    expect(s.manualCents).toBe(58_500)
    expect(s.manualYearCents).toBe(100_000)
    expect(s.totalCents).toBe(166_000)
    expect(s.previousYearTotalCents).toBe(99_999 + 1 + 2_000_000)
    expect(s.months).toHaveLength(12)
    const oct = s.months.find((m) => m.month === '2026-10')!
    expect(oct.cents).toEqual({
      shop: 7_500,
      tattoo: 0,
      flohmarkt: 0,
      auftragsarbeiten: 7_000,
      sonstiges: 500,
    })
    expect(oct.totalCents).toBe(15_000)
  })

  it('R-125 Beispieldaten zählen nur bei wirksamem SEED_PREVIEW_MODE (KONZEPT §11.4)', () => {
    const base = {
      year: 2026,
      now: NOW,
      invoices: [inv('2026-10', 2_000_000, true), inv('2026-10', 100)],
      entries: [entry('2026-09', 'tattoo', 500_000, true)],
      manualYearTotals: [],
    }
    const off = compute({ ...base, includeSeed: false })
    expect(off.totalCents).toBe(100)
    expect(off.reached).toEqual([])
    const on = compute({ ...base, includeSeed: true })
    expect(on.totalCents).toBe(2_500_100)
    expect(on.reached.map((r) => r.stage)).toEqual(['U1', 'U2'])
  })

  it('R-125 pending = erreichte Stufen ohne die schon gemeldeten des Jahres; current ohne U0', () => {
    const s = compute({
      year: 2027,
      now: new Date('2027-01-01T06:00:00.000Z'),
      invoices: [inv('2026-06', 2_600_000), inv('2027-01', 2_000_000)],
      entries: [],
      manualYearTotals: [],
      includeSeed: false,
      lastNotified: { '2026': ['U1', 'U2'], '2027': ['U0'] },
    })
    expect(s.reached.map((r) => r.stage)).toEqual(['U0', 'U1'])
    expect(s.pending.map((r) => r.stage)).toEqual(['U1'])
    expect(s.current).toBe('U1')
  })

  it('R-125 U0 erst ab dem 1. Januar des betrachteten Jahres (Europe/Berlin)', () => {
    const input = {
      year: 2027,
      invoices: [inv('2026-06', 2_600_000)],
      entries: [],
      manualYearTotals: [],
      includeSeed: false,
    }
    // 31.12.2026 23:59 Berlin
    expect(compute({ ...input, now: new Date('2026-12-31T22:59:00.000Z') }).reached).toEqual([])
    // 01.01.2027 00:00 Berlin
    expect(
      compute({ ...input, now: new Date('2026-12-31T23:00:00.000Z') }).reached.map((r) => r.stage),
    ).toEqual(['U0'])
  })

  it('R-125 lastNotified: robust lesen, Stufen je Jahr ohne Doppel in fester Reihenfolge ergänzen', () => {
    expect(parseLastNotified(null)).toEqual({})
    expect(parseLastNotified({ '2026': ['U2', 'X', 1], foo: ['U1'] })).toEqual({ '2026': ['U2'] })
    expect(withNotified({ '2026': ['U2'] }, 2026, ['U1', 'U2'])).toEqual({ '2026': ['U1', 'U2'] })
    expect(withNotified({}, 2027, ['U0'])).toEqual({ '2027': ['U0'] })
  })

  it('R-125 Meldungstexte je Stufe (KONZEPT §8.4): U2 mit Folgejahr, U4 mit Rest, U5 Steuermodus', () => {
    const ctx = { year: 2026, totalCents: 9_550_000, thresholds: DEFAULT_REVENUE_THRESHOLDS }
    expect(stageMessage('U1', ctx)).toContain('80 % der Grenze von 25.000 €')
    expect(stageMessage('U2', ctx)).toContain('Ab 1. Januar 2027 keine Kleinunternehmerregelung')
    expect(stageMessage('U3', ctx)).toBe('80 % der Grenze von 100.000 € erreicht.')
    expect(stageMessage('U3a', ctx)).toContain('Dringend: 90.000 € erreicht')
    expect(stageMessage('U4', ctx)).toBe(
      'Nur noch 4.500 € bis 100.000 € – Steuerberatung jetzt kontaktieren.',
    )
    expect(stageMessage('U5', ctx)).toContain('Steuermodus umstellen')
    expect(stageMessage('U0', ctx)).toContain('Dieses Jahr gilt die Kleinunternehmerregelung nicht')
  })
})
