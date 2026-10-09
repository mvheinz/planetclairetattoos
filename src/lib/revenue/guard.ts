// Umsatz-Wächter (KONZEPT §8.4, R-125, E-45, PLAN P5.23) – reine Rechnung ohne Datenbank: Summen je Jahr und Monat,
// erreichte Stufen U0–U5, noch nicht gemeldete Stufen. Laden und Melden (A09) übernimmt `src/lib/revenue/check.ts`.
//
// Shop-Umsatz = Rechnungen − Gutschriften nach Belegdatum (Europe/Berlin), Gesamtumsatz = Shop + Markt-Verkäufe von
// Stücken mit Preis (`products.offlineSalePriceCents`, U-60/P14.11, nach Verkaufsdatum) + manuelle Monatssummen
// (`revenue-entries`) + `settings.revenueGuard.manualYearTotals` (Umsätze vor dem Shop, die nicht schon als
// Monatssumme erfasst sind). Beispieldaten (`seed = true`) zählen nur bei wirksamem `SEED_PREVIEW_MODE` (KONZEPT §11.4).

import { REVENUE_GUARD_STAGES, REVENUE_SOURCES, type RevenueGuardStage } from '@/lib/enums'
import type { RevenueSource } from '@/lib/enums'
import { formatMoney } from '@/lib/money'
import { berlinYear } from '@/lib/time'

/** Monatssumme der Belege (Loader gruppiert nach Berliner Monat, Belegart und Seed-Kennzeichen). */
export interface InvoiceMonthSum {
  /** `YYYY-MM` des Belegdatums in Europe/Berlin. */
  month: string
  type: 'invoice' | 'credit_note'
  seed: boolean
  /** Summe der Bruttobeträge (positiv, auch bei Gutschriften). */
  grossCents: number
}

export interface RevenueEntrySum {
  month: string
  source: RevenueSource
  seed: boolean
  amountCents: number
}

/** Monatssumme der Markt-Verkäufe von Stücken mit Preis (U-60): `soldChannel = offline`, nach `soldAt` (Berlin). */
export interface OfflineSaleMonthSum {
  month: string
  seed: boolean
  amountCents: number
}

export interface ManualYearTotal {
  year: number
  amountCents: number
}

/** Grenzen und Schwellen aus `settings.revenueGuard` (Standard: § 19 UStG ab 01.01.2025). */
export interface RevenueThresholds {
  u1Cents: number
  /** Vorjahresgrenze (U2 bei Überschreiten, U0 im Folgejahr). */
  previousYearLimitCents: number
  u3Cents: number
  u3aCents: number
  u4Cents: number
  /** Grenze laufendes Jahr (U5 bei Überschreiten). */
  currentYearLimitCents: number
}

export const DEFAULT_REVENUE_THRESHOLDS: RevenueThresholds = {
  u1Cents: 2_000_000,
  previousYearLimitCents: 2_500_000,
  u3Cents: 8_000_000,
  u3aCents: 9_000_000,
  u4Cents: 9_500_000,
  currentYearLimitCents: 10_000_000,
}

/** `settings.revenueGuard.lastNotified`: je Jahr die bereits gemeldeten Stufen (`{ "2026": ["U1"] }`). */
export type LastNotified = Record<string, RevenueGuardStage[]>

export interface RevenueStatusInput {
  /** Betrachtetes Kalenderjahr (Europe/Berlin). */
  year: number
  /** Injizierte Zeit (A-08); bestimmt, ob U0 schon fällig ist (ab 1. Januar des Jahres). */
  now: Date
  invoices: readonly InvoiceMonthSum[]
  entries: readonly RevenueEntrySum[]
  /** Markt-Verkäufe von Stücken mit Preis (U-60); fehlt = keine. */
  offlineSales?: readonly OfflineSaleMonthSum[]
  manualYearTotals: readonly ManualYearTotal[]
  thresholds?: RevenueThresholds
  /** `seedPreviewModeActive()` – sonst zählen Beispieldaten nie. */
  includeSeed: boolean
  lastNotified?: LastNotified | null
}

export type RevenueColumn = 'shop' | 'offline' | RevenueSource

export interface RevenueMonthRow {
  month: string
  /** Shop (Rechnungen − Gutschriften) und je Quelle der manuellen Monatssummen. */
  cents: Record<RevenueColumn, number>
  totalCents: number
}

export interface RevenueStage {
  stage: RevenueGuardStage
  /** Maßgebliche Schwelle (Cent). */
  thresholdCents: number
  /** `>=` bzw. `>` wie in KONZEPT §8.4. */
  comparison: 'gte' | 'gt'
}

export interface RevenueStatus {
  year: number
  months: RevenueMonthRow[]
  shopCents: number
  /** Markt-Verkäufe von Stücken mit Preis (U-60). */
  offlineCents: number
  manualCents: number
  manualYearCents: number
  totalCents: number
  previousYear: number
  previousYearTotalCents: number
  /** Erreichte Stufen in fester Reihenfolge (U0, U1 … U5). */
  reached: RevenueStage[]
  /** Erreichte, aber noch nicht gemeldete Stufen (je eine A09). */
  pending: RevenueStage[]
  /** Höchste erreichte Stufe des laufenden Jahres (ohne U0) bzw. `null`. */
  current: RevenueGuardStage | null
  thresholds: RevenueThresholds
}

export const REVENUE_COLUMNS: readonly RevenueColumn[] = ['shop', 'offline', ...REVENUE_SOURCES]

const monthsOf = (year: number) =>
  Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)

function yearTotals(
  year: number,
  input: Pick<
    RevenueStatusInput,
    'invoices' | 'entries' | 'offlineSales' | 'manualYearTotals' | 'includeSeed'
  >,
) {
  const prefix = `${year}-`
  const rows = new Map<string, RevenueMonthRow>(
    monthsOf(year).map((m) => [
      m,
      {
        month: m,
        cents: Object.fromEntries(REVENUE_COLUMNS.map((c) => [c, 0])) as Record<
          RevenueColumn,
          number
        >,
        totalCents: 0,
      },
    ]),
  )
  let shop = 0
  let offline = 0
  let manual = 0
  for (const inv of input.invoices) {
    if (!inv.month.startsWith(prefix) || (inv.seed && !input.includeSeed)) continue
    const signed = inv.type === 'credit_note' ? -inv.grossCents : inv.grossCents
    const row = rows.get(inv.month)
    if (!row) continue
    row.cents.shop += signed
    row.totalCents += signed
    shop += signed
  }
  for (const o of input.offlineSales ?? []) {
    if (!o.month.startsWith(prefix) || (o.seed && !input.includeSeed)) continue
    const row = rows.get(o.month)
    if (!row) continue
    row.cents.offline += o.amountCents
    row.totalCents += o.amountCents
    offline += o.amountCents
  }
  for (const e of input.entries) {
    if (!e.month.startsWith(prefix) || (e.seed && !input.includeSeed)) continue
    const row = rows.get(e.month)
    if (!row) continue
    row.cents[e.source] += e.amountCents
    row.totalCents += e.amountCents
    manual += e.amountCents
  }
  const manualYear = input.manualYearTotals
    .filter((t) => t.year === year)
    .reduce((n, t) => n + t.amountCents, 0)
  return {
    months: [...rows.values()],
    shopCents: shop,
    offlineCents: offline,
    manualCents: manual,
    manualYearCents: manualYear,
    totalCents: shop + offline + manual + manualYear,
  }
}

/** Stufen des laufenden Jahres (U1–U5) bzw. U0 aus dem Vorjahr (KONZEPT §8.4, R-125). */
export function reachedStages(
  totalCents: number,
  previousYearTotalCents: number,
  t: RevenueThresholds = DEFAULT_REVENUE_THRESHOLDS,
): RevenueStage[] {
  const all: (RevenueStage & { hit: boolean })[] = [
    {
      stage: 'U0',
      thresholdCents: t.previousYearLimitCents,
      comparison: 'gt',
      hit: previousYearTotalCents > t.previousYearLimitCents,
    },
    { stage: 'U1', thresholdCents: t.u1Cents, comparison: 'gte', hit: totalCents >= t.u1Cents },
    {
      stage: 'U2',
      thresholdCents: t.previousYearLimitCents,
      comparison: 'gt',
      hit: totalCents > t.previousYearLimitCents,
    },
    { stage: 'U3', thresholdCents: t.u3Cents, comparison: 'gte', hit: totalCents >= t.u3Cents },
    { stage: 'U3a', thresholdCents: t.u3aCents, comparison: 'gte', hit: totalCents >= t.u3aCents },
    { stage: 'U4', thresholdCents: t.u4Cents, comparison: 'gte', hit: totalCents >= t.u4Cents },
    {
      stage: 'U5',
      thresholdCents: t.currentYearLimitCents,
      comparison: 'gt',
      hit: totalCents > t.currentYearLimitCents,
    },
  ]
  const order = new Map(REVENUE_GUARD_STAGES.map((s, i) => [s, i]))
  return all
    .filter((s) => s.hit)
    .map(({ hit: _hit, ...s }) => s)
    .sort((a, b) => order.get(a.stage)! - order.get(b.stage)!)
}

export function computeRevenueStatus(input: RevenueStatusInput): RevenueStatus {
  const thresholds = input.thresholds ?? DEFAULT_REVENUE_THRESHOLDS
  const cur = yearTotals(input.year, input)
  const prev = yearTotals(input.year - 1, input)
  // U0 erst ab dem 1. Januar des betrachteten Jahres (Berlin) – vorher ist das „Vorjahr“ noch nicht abgeschlossen.
  const u0Due = berlinYear(input.now) >= input.year
  const reached = reachedStages(cur.totalCents, u0Due ? prev.totalCents : 0, thresholds)
  const notified = new Set(input.lastNotified?.[String(input.year)] ?? [])
  const current = [...reached].reverse().find((s) => s.stage !== 'U0')?.stage ?? null
  return {
    year: input.year,
    months: cur.months,
    shopCents: cur.shopCents,
    offlineCents: cur.offlineCents,
    manualCents: cur.manualCents,
    manualYearCents: cur.manualYearCents,
    totalCents: cur.totalCents,
    previousYear: input.year - 1,
    previousYearTotalCents: prev.totalCents,
    reached,
    pending: reached.filter((s) => !notified.has(s.stage)),
    current,
    thresholds,
  }
}

/** Grenzen aus `settings.revenueGuard` (fehlende Werte → Standard). */
export function thresholdsFromSettings(
  g:
    | {
        previousYearLimitCents?: number | string | null
        currentYearLimitCents?: number | string | null
        stageThresholdsCents?: {
          u1?: number | string | null
          u3?: number | string | null
          u3a?: number | string | null
          u4?: number | string | null
        } | null
      }
    | null
    | undefined,
): RevenueThresholds {
  const d = DEFAULT_REVENUE_THRESHOLDS
  const n = (v: unknown, fallback: number) => {
    const x = typeof v === 'string' ? Number(v) : v
    return typeof x === 'number' && Number.isSafeInteger(x) && x >= 0 ? x : fallback
  }
  const s = g?.stageThresholdsCents ?? {}
  return {
    u1Cents: n(s.u1, d.u1Cents),
    previousYearLimitCents: n(g?.previousYearLimitCents, d.previousYearLimitCents),
    u3Cents: n(s.u3, d.u3Cents),
    u3aCents: n(s.u3a, d.u3aCents),
    u4Cents: n(s.u4, d.u4Cents),
    currentYearLimitCents: n(g?.currentYearLimitCents, d.currentYearLimitCents),
  }
}

/** `lastNotified` robust lesen (JSON aus der Datenbank). */
export function parseLastNotified(value: unknown): LastNotified {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: LastNotified = {}
  const known = new Set<string>(REVENUE_GUARD_STAGES)
  for (const [year, stages] of Object.entries(value as Record<string, unknown>)) {
    if (!/^\d{4}$/.test(year) || !Array.isArray(stages)) continue
    out[year] = stages.filter((s): s is RevenueGuardStage => typeof s === 'string' && known.has(s))
  }
  return out
}

/** Neues `lastNotified` mit zusätzlich gemeldeten Stufen (Reihenfolge wie `REVENUE_GUARD_STAGES`). */
export function withNotified(
  last: LastNotified,
  year: number,
  stages: readonly RevenueGuardStage[],
): LastNotified {
  const key = String(year)
  const set = new Set([...(last[key] ?? []), ...stages])
  return { ...last, [key]: REVENUE_GUARD_STAGES.filter((s) => set.has(s)) }
}

const euro = (cents: number) =>
  cents < 0
    ? `−${formatMoney(-cents, 'de', { style: 'tag' })}`
    : formatMoney(cents, 'de', { style: 'tag' })

/** Kurztitel je Stufe (Betreff A09: „Umsatz-Wächter: {Schwelle} erreicht“). */
export const STAGE_TITLES: Record<RevenueGuardStage, string> = {
  U0: 'Vorjahr über der Kleinunternehmergrenze',
  U1: '80 % der Vorjahresgrenze',
  U2: 'Vorjahresgrenze überschritten',
  U3: '80 % der Jahresgrenze',
  U3a: '90 % der Jahresgrenze',
  U4: '95 % der Jahresgrenze',
  U5: 'Jahresgrenze überschritten',
}

/** Meldungstext je Stufe (KONZEPT §8.4, R-125); `{Rest}` bzw. `{Jahr}` aus Stand und Schwellen. */
export function stageMessage(
  stage: RevenueGuardStage,
  ctx: { year: number; totalCents: number; thresholds: RevenueThresholds },
): string {
  const t = ctx.thresholds
  const prevLimit = euro(t.previousYearLimitCents)
  const curLimit = euro(t.currentYearLimitCents)
  switch (stage) {
    case 'U0':
      return `Dieses Jahr gilt die Kleinunternehmerregelung nicht (Vorjahr über ${prevLimit}). Steuermodus mit der Steuerberatung prüfen (Einstellungen → Steuer).`
    case 'U1':
      return `80 % der Grenze von ${prevLimit} erreicht. Liegst du am Jahresende darüber, gilt ab 1. Januar ${ctx.year + 1} die Regelbesteuerung. Sprich mit der Steuerberatung.`
    case 'U2':
      return `${prevLimit} überschritten: Ab 1. Januar ${ctx.year + 1} keine Kleinunternehmerregelung. Umstellung vorbereiten und mit der Steuerberatung sprechen.`
    case 'U3':
      return `80 % der Grenze von ${curLimit} erreicht.`
    case 'U3a':
      return `Dringend: ${euro(t.u3aCents)} erreicht – die Grenze von ${curLimit} ist nah.`
    case 'U4':
      return `Nur noch ${euro(Math.max(0, t.currentYearLimitCents - ctx.totalCents))} bis ${curLimit} – Steuerberatung jetzt kontaktieren.`
    case 'U5':
      return `${curLimit} überschritten: Ab jetzt gilt die Regelbesteuerung. Steuermodus umstellen (Einstellungen → Steuer).`
  }
}

/** Hinweis in der Ansicht und in A09 (KONZEPT §8.4). */
export const REVENUE_GUARD_DISCLAIMER = 'Der Wächter ersetzt keine Steuerberatung.'

export { euro as formatSignedEuro }
