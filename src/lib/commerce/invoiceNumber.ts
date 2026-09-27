import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import type { PayloadRequest } from 'payload'

import type { InvoiceSeries, InvoiceType } from '@/lib/enums'
import { dbFor } from '@/lib/db/tx'

// Lückenlose Belegnummern (DATENMODELL §8.6, GoBD): Zählerzeile je Serie und Jahr mit Row-Lock. `ON CONFLICT DO
// UPDATE` sperrt die Zeile bis zum Commit; parallele Belege warten. Ein Rollback setzt den Zähler mit zurück.

export const INVOICE_NUMBER_RE = /^(BSP-)?(RE|GS)-\d{4}-\d{5}$/

export function invoiceSeriesFor(type: InvoiceType, seed: boolean): InvoiceSeries {
  const base = type === 'invoice' ? 'RE' : 'GS'
  return (seed ? `BSP-${base}` : base) as InvoiceSeries
}

export function formatInvoiceNumber(series: InvoiceSeries, year: number, n: number): string {
  return `${series}-${year}-${String(n).padStart(5, '0')}`
}

/**
 * Zieht die nächste Nummer in der Transaktion von `req` (Pflicht: sonst wäre die Nummer schon vor dem Beleg
 * vergeben). `now` = injizierte Zeit (A-08).
 */
export async function nextInvoiceNumber(
  req: PayloadRequest,
  series: InvoiceSeries,
  year: number,
  now: Date,
): Promise<{ number: string; sequenceNumber: number }> {
  if (!req.transactionID) {
    throw new Error('Belegnummern nur innerhalb einer Transaktion (DATENMODELL §8.6).')
  }
  const db = await dbFor(req)
  const at = now.toISOString()
  const res = await db.execute(sql`
    INSERT INTO invoice_counters (series, year, last_number, created_at, updated_at)
    VALUES (${series}, ${year}, 1, ${at}::timestamptz, ${at}::timestamptz)
    ON CONFLICT (series, year)
    DO UPDATE SET last_number = invoice_counters.last_number + 1, updated_at = ${at}::timestamptz
    RETURNING last_number`)
  const n = Number(res.rows[0]?.last_number)
  if (!Number.isSafeInteger(n) || n < 1) throw new Error('Zählerstand ungültig')
  return { number: formatInvoiceNumber(series, year, n), sequenceNumber: n }
}
