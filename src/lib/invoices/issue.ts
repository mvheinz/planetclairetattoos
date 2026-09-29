import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import { createElement } from 'react'
import { createLocalReq, type Payload, type PayloadRequest } from 'payload'

import { dbFor } from '@/lib/db/tx'
import { requestNow } from '@/lib/payload/context'
import { preservingReq } from '@/lib/payload/localReq'
import { inTransaction } from '@/lib/payload/transaction'
import { InvoiceDocument } from '@/lib/pdf/InvoiceDocument'
import { renderPdf, type RenderedPdf } from '@/lib/pdf/render'
import { invoicePrefix } from '@/lib/storage'
import { storePrivateFile } from '@/lib/uploads/preStored'
import type { Invoice } from '@/payload-types'

import { parseInvoiceData } from './schema'

// Beleg-PDF erzeugen und festschreiben (DATENMODELL §6.9, R-120, R-122): PDF aus `invoice.data` → `private-uploads`
// (`purpose = invoice_pdf | credit_note_pdf`, Präfix `private/invoices/{JJJJ}`, Datei `{Nummer}.pdf`), dann
// `pdf`, `sha256`, `renderedAt`, `status = issued` – genau einmal (Zeilensperre; ein zweiter Lauf tut nichts).
// Der Seed (P8.4) ruft `issueInvoicePdf` direkt auf, ohne Job (SEED-SPEC §9); `seed = true` ⇒ Wasserzeichen.

type InvoiceRow = Pick<Invoice, 'number' | 'type' | 'issueDate' | 'seed' | 'data'>

/** Rendert das PDF eines Belegs (ohne zu speichern). */
export function renderInvoicePdfFile(invoice: InvoiceRow): Promise<RenderedPdf> {
  return renderPdf(
    createElement(InvoiceDocument, {
      number: invoice.number,
      type: invoice.type,
      issueDate: invoice.issueDate,
      seed: invoice.seed === true,
      data: parseInvoiceData(invoice.data),
    }) as Parameters<typeof renderPdf>[0],
  )
}

export interface IssueInvoicePdfResult {
  status: 'issued' | 'already_issued'
  sha256: string
  uploadId: number | null
}

export async function issueInvoicePdf(
  req: PayloadRequest,
  invoiceId: number,
): Promise<IssueInvoicePdfResult> {
  return inTransaction(req, async () => {
    const db = await dbFor(req)
    await db.execute(sql`SELECT id FROM invoices WHERE id = ${invoiceId} FOR UPDATE`)
    const invoice = await preservingReq(req, () =>
      req.payload.findByID({
        collection: 'invoices',
        id: invoiceId,
        depth: 0,
        overrideAccess: true,
        req,
      }),
    )
    if (invoice.status === 'issued') {
      return { status: 'already_issued', sha256: invoice.sha256 ?? '', uploadId: null }
    }
    const now = requestNow(req)
    const context = { ...req.context, system: true, now: now.toISOString() }
    const pdf = await renderInvoicePdfFile(invoice)
    // R-122: nur schreiben, wenn die Datei noch nicht existiert (`putIfAbsent`), Pfad `private/invoices/{JJJJ}/{Nummer}.pdf`
    const upload = await storePrivateFile(req, {
      purpose: invoice.type === 'invoice' ? 'invoice_pdf' : 'credit_note_pdf',
      prefix: invoicePrefix(invoice.year),
      filename: `${invoice.number}.pdf`,
      bytes: Buffer.from(pdf.data),
      contentType: 'application/pdf',
      data: { relatedInvoice: invoice.id, seed: invoice.seed === true },
      context,
    })
    await preservingReq(req, () =>
      req.payload.update({
        collection: 'invoices',
        id: invoice.id,
        data: {
          pdf: upload.id,
          sha256: pdf.sha256,
          renderedAt: now.toISOString(),
          status: 'issued',
        } as never,
        depth: 0,
        overrideAccess: true,
        req,
        context,
      }),
    )
    return { status: 'issued', sha256: pdf.sha256, uploadId: upload.id as number }
  })
}

/** Direkte Ausführung nach dem Commit (DATENMODELL §11); Fehler bleiben im Job und werden wiederholt. */
export async function runInvoicePdfJob(
  payload: Payload,
  jobId: number | string | null,
  options: { now?: Date } = {},
): Promise<void> {
  if (jobId === null) return
  const req = await createLocalReq(
    { context: options.now ? { now: options.now.toISOString() } : {} },
    payload,
  )
  await payload.jobs.runByID({ id: jobId, req })
}
