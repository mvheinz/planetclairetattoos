import 'server-only'

import {
  commitTransaction,
  createLocalReq,
  initTransaction,
  killTransaction,
  type Payload,
} from 'payload'

import { notifyAdmin } from '@/lib/email/notifyAdmin'
import { REVENUE_SOURCES, type RevenueSource } from '@/lib/enums'
import type { PaymentsAdapter } from '@/lib/payments'
import { exportPrefix } from '@/lib/storage'
import { addBerlinMonths, berlinMonthKey } from '@/lib/time'
import { storePrivateFile } from '@/lib/uploads/preStored'

import { buildInvoiceZip } from './invoiceZip'
import { buildMonthlyCsv } from './monthlyCsv'

// Monatsabschluss (KONZEPT §7.15, §8.2, DATENMODELL §11, PLAN P5.26): für den Vormonat Monats-CSV und Rechnungs-ZIP
// erzeugen und privat ablegen (`private-uploads`, Zweck `monthly_export`, Präfix `private/exports/{JJJJ}`, Aufbewahrung L-07; nur schreiben, wenn
// die Datei noch nicht existiert, R-122), dann A11 mit Summen und
// Hinweis auf fehlende manuelle Monatssummen (`revenue-entries`). Je Monat nur einmal: vorhandene Ablage (Notiz
// `monthly_close:{JJJJ-MM}`) bzw. derselbe A11-Schlüssel ⇒ ohne Wirkung. Exporte enthalten nie Beispieldaten.

export const monthlyCloseNote = (month: string) => `monthly_close:${month}`

export interface MonthlyCloseResult {
  month: string
  status: 'created' | 'exists'
  uploadIds: number[]
  mailJobId: number | string | null
}

/** Vormonat (Berliner Kalender) zum Zeitpunkt `now`. */
export const previousMonth = (now: Date) => berlinMonthKey(addBerlinMonths(now, -1))

export async function missingManualSources(payload: Payload, month: string): Promise<RevenueSource[]> {
  const res = await payload.find({
    collection: 'revenue-entries',
    where: { month: { equals: month } },
    depth: 0,
    pagination: false,
    overrideAccess: true,
    select: { source: true },
  })
  const present = new Set(res.docs.map((d) => (d as { source: RevenueSource }).source))
  return REVENUE_SOURCES.filter((s) => !present.has(s))
}

export async function runMonthlyClose(
  payload: Payload,
  now: Date,
  options: { month?: string; payments?: Pick<PaymentsAdapter, 'listBalanceTransactions'> } = {},
): Promise<MonthlyCloseResult> {
  const month = options.month ?? previousMonth(now)
  const note = monthlyCloseNote(month)
  const existing = await payload.find({
    collection: 'private-uploads',
    where: { and: [{ purpose: { equals: 'monthly_export' } }, { note: { equals: note } }] },
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  if (existing.docs.length > 0) {
    return {
      month,
      status: 'exists',
      uploadIds: existing.docs.map((d) => d.id as number),
      mailJobId: null,
    }
  }

  // Erst beides bauen (ZIP scheitert, solange ein Beleg-PDF fehlt), dann in einer Transaktion ablegen und A11 einreihen.
  const csv = await buildMonthlyCsv(payload, month, { payments: options.payments })
  const zip = await buildInvoiceZip(payload, month, { payments: options.payments })
  const req = await createLocalReq({ context: { system: true, now: now.toISOString() } }, payload)
  await initTransaction(req)
  try {
    const uploadIds: number[] = []
    const prefix = exportPrefix(Number(month.slice(0, 4)))
    for (const file of [
      { filename: csv.filename, bytes: csv.bytes, contentType: 'text/csv' },
      { filename: zip.filename, bytes: zip.bytes, contentType: 'application/zip' },
    ]) {
      const doc = await storePrivateFile(req, {
        purpose: 'monthly_export',
        prefix,
        ...file,
        data: { note },
      })
      uploadIds.push(doc.id as number)
    }
    const invoices = csv.documents.filter((d) => d.type === 'invoice')
    const credits = csv.documents.filter((d) => d.type === 'credit_note')
    const mail = await notifyAdmin(
      req,
      'admin_monthly_close',
      {
        month,
        invoiceCount: invoices.length,
        invoiceTotalCents: invoices.reduce((n, d) => n + d.grossCents, 0),
        creditNoteCount: credits.length,
        creditNoteTotalCents: credits.reduce((n, d) => n - d.grossCents, 0),
        missingManualSources: await missingManualSources(payload, month),
      },
      { idempotencyKey: `admin_monthly_close:${month}`, now },
    )
    await commitTransaction(req)
    return { month, status: 'created', uploadIds, mailJobId: mail.jobId }
  } catch (err) {
    await killTransaction(req)
    throw err
  }
}
