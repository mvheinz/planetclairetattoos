import 'server-only'

import type { Payload } from 'payload'

import { ENUM_LABELS } from '@/lib/enumLabels'
import { getPaymentsAdapter, type BalanceTransaction, type PaymentsAdapter } from '@/lib/payments'
import { addBerlinMonths } from '@/lib/time'

import { loadMonthDocuments, monthRange, type ExportDocument } from './documents'
import { berlinDate, csvLine, decimalComma, UTF8_BOM } from './format'

// Monatsexport CSV (KONZEPT §7.15, R-124, E-04, PLAN P5.24): `planetclaire-{JJJJ-MM}.csv`, UTF-8 mit BOM, `;`, CRLF,
// Dezimalkomma, Datum `TT.MM.JJJJ`, sortiert nach Belegnummer. Keine Namen, Adressen oder E-Mails. Gebühren und
// Auszahlungen über `payments.listBalanceTransactions` (Mock: Fixtures). Beispieldaten nie (siehe `documents.ts`).

export const MONTHLY_CSV_HEADER = [
  'Belegdatum',
  'Belegart',
  'Belegnummer',
  'Bestellnummer',
  'Zahlart',
  'Betrag brutto',
  'davon Versand',
  'Steuermodus',
  'Steuersatz',
  'Steuerbetrag',
  'Zahlungsdatum',
  'Stripe-Zahlungs-ID bzw. Stripe-Erstattungs-ID',
  'Stripe-Gebühr',
  'Auszahlungs-ID',
  'Auszahlungsdatum',
] as const

export const monthlyCsvFilename = (month: string) => `planetclaire-${month}.csv`

const TAX_MODE_LABEL = {
  kleinunternehmer: 'Kleinunternehmer',
  regelbesteuert: 'Regelbesteuerung',
} as const

/**
 * Buchungen von Stripe zu den Belegen des Monats: Zeitraum ab einem Monat vor Monatsbeginn (Zahlung kann vor dem
 * Belegdatum liegen) bis Monatsende. Ohne Stripe-ID eines Belegs (Vorkasse) bleibt die Zuordnung leer.
 */
export async function balanceTransactionsFor(
  month: string,
  payments: Pick<PaymentsAdapter, 'listBalanceTransactions'>,
): Promise<Map<string, BalanceTransaction>> {
  const { start, end } = monthRange(month)
  const txns = await payments.listBalanceTransactions({ from: addBerlinMonths(start, -1), to: end })
  const bySource = new Map<string, BalanceTransaction>()
  for (const t of txns) if (t.sourceId && !bySource.has(t.sourceId)) bySource.set(t.sourceId, t)
  return bySource
}

export function monthlyCsvRow(doc: ExportDocument, txn: BalanceTransaction | undefined): string[] {
  const hasStripe = doc.stripeId !== null
  return [
    berlinDate(doc.issueDate),
    doc.kind,
    doc.number,
    doc.orderNumber,
    ENUM_LABELS.PAYMENT_METHODS[doc.paymentMethod].de,
    decimalComma(doc.grossCents),
    decimalComma(doc.shippingCents),
    TAX_MODE_LABEL[doc.taxMode],
    doc.rates.length === 0 ? '0' : doc.rates.join('/'),
    decimalComma(doc.taxCents),
    berlinDate(doc.paidAt),
    doc.stripeId ?? '',
    hasStripe ? decimalComma(txn?.feeCents ?? 0) : '',
    txn?.payoutId ?? '',
    berlinDate(txn?.payoutDate ?? null),
  ]
}

/** CSV aus bereits geladenen Belegen (rein, für Tests und ZIP). */
export function renderMonthlyCsv(
  docs: readonly ExportDocument[],
  txns: ReadonlyMap<string, BalanceTransaction>,
): Buffer {
  let out = UTF8_BOM + csvLine(MONTHLY_CSV_HEADER)
  for (const d of docs)
    out += csvLine(monthlyCsvRow(d, d.stripeId ? txns.get(d.stripeId) : undefined))
  return Buffer.from(out, 'utf8')
}

export interface MonthlyCsvResult {
  filename: string
  bytes: Buffer
  documents: ExportDocument[]
}

export async function buildMonthlyCsv(
  payload: Payload,
  month: string,
  options: { payments?: Pick<PaymentsAdapter, 'listBalanceTransactions'> } = {},
): Promise<MonthlyCsvResult> {
  const documents = await loadMonthDocuments(payload, month)
  const txns = await balanceTransactionsFor(month, options.payments ?? getPaymentsAdapter())
  return {
    filename: monthlyCsvFilename(month),
    bytes: renderMonthlyCsv(documents, txns),
    documents,
  }
}
