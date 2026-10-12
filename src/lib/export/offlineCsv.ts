import 'server-only'

import type { Payload } from 'payload'

import { ENUM_LABELS } from '@/lib/enumLabels'
import type { RevenueSource } from '@/lib/enums'
import { formatItemNumber } from '@/lib/products/itemNumber'

import { monthRange } from './documents'
import { berlinDate, csvLine, decimalComma, UTF8_BOM } from './format'

// Zweite Tabelle des Monatsexports (V-65, U-93, E-04, R-124): „Einnahmen außerhalb des Shops“ – Markt-Verkäufe von
// Stücken mit erzieltem Preis (Aktion „Offline verkauft“, Verkaufsdatum im Berliner Monat) und die Monatssummen aus
// dem Formular „Monat abschließen“ (`revenue-entries`: Tattoo, Flohmarkt, Auftragsarbeiten, Sonstiges). Format wie die
// Monats-CSV (UTF-8 mit BOM, `;`, CRLF, Dezimalkomma, Datum `TT.MM.JJJJ` in Europe/Berlin). Beispieldaten nie; keine
// Personendaten (Markt-Verkäufe haben keine Käufer:innen-Angaben). Gleiche Eingaben ergeben byte-identische Dateien.

export const OFFLINE_CSV_HEADER = [
  'Monat',
  'Datum',
  'Art',
  'Stück-Nr.',
  'Bezeichnung',
  'Betrag brutto',
  'Notiz',
] as const

export const offlineCsvFilename = (month: string) =>
  `planetclaire-${month}-einnahmen-ausserhalb-des-shops.csv`

export interface OfflineIncomeRow {
  kind: 'market_sale' | 'monthly_sum'
  /** Verkaufsdatum (Markt-Verkauf, ISO) bzw. `null` (Monatssumme). */
  date: string | null
  itemNumber: number | null
  label: string
  amountCents: number
  note: string
}

const KIND_LABEL: Record<OfflineIncomeRow['kind'], string> = {
  market_sale: 'Markt-Verkauf (Stück)',
  monthly_sum: 'Monatssumme',
}

/** `JJJJ-MM` → `MM.JJJJ`. */
const monthLabel = (month: string) => `${month.slice(5, 7)}.${month.slice(0, 4)}`

export function renderOfflineCsv(month: string, rows: readonly OfflineIncomeRow[]): Buffer {
  let out = UTF8_BOM + csvLine(OFFLINE_CSV_HEADER)
  for (const r of rows)
    out += csvLine([
      monthLabel(month),
      berlinDate(r.date),
      KIND_LABEL[r.kind],
      r.itemNumber === null ? '' : formatItemNumber(r.itemNumber, 'de'),
      r.label,
      decimalComma(r.amountCents),
      r.note,
    ])
  return Buffer.from(out, 'utf8')
}

/** Zeilen des Monats: erst Markt-Verkäufe (nach Datum, dann Nummer), dann Monatssummen in fester Reihenfolge. */
export async function loadOfflineIncome(
  payload: Payload,
  month: string,
): Promise<OfflineIncomeRow[]> {
  const { start, end } = monthRange(month)
  const sales = await payload.find({
    collection: 'products',
    where: {
      and: [
        { soldChannel: { equals: 'offline' } },
        { offlineSalePriceCents: { exists: true } },
        { soldAt: { greater_than_equal: start.toISOString() } },
        { soldAt: { less_than: end.toISOString() } },
        { seed: { not_equals: true } },
      ],
    },
    select: {
      itemNumber: true,
      adminTitle: true,
      soldAt: true,
      offlineSalePriceCents: true,
      offlineSaleNote: true,
    },
    depth: 0,
    locale: 'de',
    pagination: false,
    overrideAccess: true,
  })
  const marketRows: OfflineIncomeRow[] = (
    sales.docs as unknown as {
      itemNumber?: number | null
      adminTitle?: string | null
      soldAt?: string | null
      offlineSalePriceCents?: number | null
      offlineSaleNote?: string | null
    }[]
  )
    .filter((d) => typeof d.offlineSalePriceCents === 'number')
    .map((d) => ({
      kind: 'market_sale' as const,
      date: d.soldAt ?? null,
      itemNumber: typeof d.itemNumber === 'number' ? d.itemNumber : null,
      label: d.adminTitle?.trim() ?? '',
      amountCents: d.offlineSalePriceCents!,
      note: d.offlineSaleNote?.trim() ?? '',
    }))
    .sort(
      (a, b) =>
        String(a.date).localeCompare(String(b.date)) || (a.itemNumber ?? 0) - (b.itemNumber ?? 0),
    )
  const entries = await payload.find({
    collection: 'revenue-entries',
    where: { and: [{ month: { equals: month } }, { seed: { not_equals: true } }] },
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  const order = Object.keys(ENUM_LABELS.REVENUE_SOURCES)
  const sumRows: OfflineIncomeRow[] = (
    entries.docs as unknown as {
      source: RevenueSource
      amountCents: number
      note?: string | null
    }[]
  )
    .sort((a, b) => order.indexOf(a.source) - order.indexOf(b.source))
    .map((e) => ({
      kind: 'monthly_sum' as const,
      date: null,
      itemNumber: null,
      label: ENUM_LABELS.REVENUE_SOURCES[e.source].de,
      amountCents: e.amountCents,
      note: e.note?.trim() ?? '',
    }))
  return [...marketRows, ...sumRows]
}

export interface OfflineCsvResult {
  filename: string
  bytes: Buffer
  rows: OfflineIncomeRow[]
}

export async function buildOfflineCsv(payload: Payload, month: string): Promise<OfflineCsvResult> {
  const rows = await loadOfflineIncome(payload, month)
  return { filename: offlineCsvFilename(month), bytes: renderOfflineCsv(month, rows), rows }
}
