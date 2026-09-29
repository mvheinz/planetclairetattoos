import 'server-only'

import type { PayloadRequest } from 'payload'

import { TASK_DEFS } from '@/jobs/index'
import type { RefundReason, TaxMode } from '@/lib/enums'
import { getAppContext, requestNow } from '@/lib/payload/context'
import { preservingReq } from '@/lib/payload/localReq'
import { inTransaction } from '@/lib/payload/transaction'
import { getTaxModeAt, type TaxSettings } from '@/lib/tax'
import type { Invoice, Order, Setting } from '@/payload-types'

import {
  buildCreditNoteData,
  buildInvoiceData,
  type CreditNoteLineInput,
  type InvoiceBusiness,
  type InvoiceOrder,
} from './build'
import { parseInvoiceData } from './schema'

// Belege anlegen (DATENMODELL §6.9, §8.6, R-120, R-121) – immer in der Transaktion des auslösenden Ereignisses (`req`):
// Nummer per Zählerzeile (Hook in `invoices`), Belegdaten `InvoiceDataV1`, Job `renderInvoicePdf` (Outbox-Muster).
// Rollt die Transaktion zurück, verschwinden Beleg, Nummer und Job. Nach dem Commit ruft der Aufrufer
// `runInvoicePdfJob(payload, jobId)` auf (direkte Ausführung); sonst erledigt es der Job-Wecker.
// Beispielbestellungen (`seed = true`) bekommen Belege der Serien BSP-RE/BSP-GS (Hook); im Seed-Kontext wird kein Job
// eingereiht – der Seed rendert direkt (`issueInvoicePdf`, SEED-SPEC §9).

export interface CreateInvoiceOptions {
  /** IDs der zu berechnenden Positionen (`orders.items[].id`); Standard: alle (bei S4 nur die gelieferten, §8.4). */
  lines?: readonly string[]
  /** Zahlungszeitpunkt (= Leistungszeitpunkt, Anzeige als Monat). */
  paidAt: Date
  /** Injizierte Zeit (Ausstellungsdatum, A-08). */
  now: Date
}

export interface CreatedInvoice {
  invoice: Invoice
  /** Job `renderInvoicePdf` (nach dem Commit direkt ausführen); `null` im Seed-Kontext. */
  jobId: number | string | null
}

async function loadSettings(req: PayloadRequest): Promise<Setting> {
  return preservingReq(req, () =>
    req.payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true, req }),
  )
}

function businessOf(settings: Setting): InvoiceBusiness {
  return settings.business as InvoiceBusiness
}

async function queueRender(
  req: PayloadRequest,
  invoiceId: number,
): Promise<number | string | null> {
  if (getAppContext(req).seed) return null
  const job = await req.payload.jobs.queue({
    task: 'renderInvoicePdf',
    input: { invoiceId },
    queue: TASK_DEFS.renderInvoicePdf.queue,
    req,
  })
  return job.id
}

const idOf = (v: unknown): number | null =>
  v === null || v === undefined
    ? null
    : typeof v === 'object'
      ? (v as { id: number }).id
      : Number(v)

/** Rechnung zu einer bezahlten Bestellung (R-120); genau eine je Bestellung (partieller UNIQUE-Index). */
export async function createInvoiceForOrder(
  req: PayloadRequest,
  order: Order,
  options: CreateInvoiceOptions,
): Promise<CreatedInvoice> {
  return inTransaction(req, async () => {
    const context = { ...req.context, system: true, now: options.now.toISOString() }
    const settings = await loadSettings(req)
    const taxMode: TaxMode = getTaxModeAt(settings as TaxSettings, options.now)
    const items = options.lines
      ? order.items.filter((i) => i.id && options.lines!.includes(i.id))
      : order.items
    if (options.lines && items.length !== options.lines.length) {
      throw new Error('Rechnung: unbekannte Position.')
    }
    const data = buildInvoiceData({
      order: order as unknown as InvoiceOrder,
      business: businessOf(settings),
      taxMode,
      items,
      paidAt: options.paidAt,
      deliveryDate: options.paidAt,
    })
    const invoice = await preservingReq(req, () =>
      req.payload.create({
        collection: 'invoices',
        data: {
          type: 'invoice',
          order: order.id,
          deliveryDate: options.paidAt.toISOString(),
          totalGrossCents: data.totalGrossCents,
          totalNetCents: data.totalGrossCents - sumTax(data),
          totalTaxCents: sumTax(data),
          data,
          seed: order.seed === true,
        } as never,
        depth: 0,
        overrideAccess: true,
        req,
        context,
      }),
    )
    await preservingReq(req, () =>
      req.payload.update({
        collection: 'orders',
        id: order.id,
        data: { invoice: invoice.id } as never,
        depth: 0,
        overrideAccess: true,
        req,
        context,
      }),
    )
    return { invoice, jobId: await queueRender(req, invoice.id) }
  })
}

const sumTax = (data: { taxLines: readonly { taxCents: number }[] }) =>
  data.taxLines.reduce((n, t) => n + t.taxCents, 0)

export interface CreateCreditNoteOptions {
  amountCents: number
  reason: RefundReason
  /** Erstattete Zeilen (Standard: eine Zeile „Erstattung zu Rechnung …“); Summe = `amountCents`. */
  lines?: readonly CreditNoteLineInput[]
  /** Injizierte Zeit (Standard: `req.context.now` bzw. Systemuhr). */
  now?: Date
}

/** Gutschrift zu einer Rechnung (R-121: Storno statt Löschen), Serie GS bzw. BSP-GS. */
export async function createCreditNote(
  req: PayloadRequest,
  invoice: Invoice,
  options: CreateCreditNoteOptions,
): Promise<CreatedInvoice> {
  return inTransaction(req, async () => {
    const now = options.now ?? requestNow(req)
    const context = { ...req.context, system: true, now: now.toISOString() }
    if (invoice.type !== 'invoice') throw new Error('Gutschrift nur zu einer Rechnung.')
    const settings = await loadSettings(req)
    const taxMode: TaxMode = getTaxModeAt(settings as TaxSettings, now)
    const data = buildCreditNoteData({
      invoice: { number: invoice.number, data: parseInvoiceData(invoice.data) },
      taxMode,
      amountCents: options.amountCents,
      lines: options.lines,
      refundedAt: now,
    })
    const credit = await preservingReq(req, () =>
      req.payload.create({
        collection: 'invoices',
        data: {
          type: 'credit_note',
          order: idOf(invoice.order),
          relatedInvoice: invoice.id,
          reason: options.reason,
          deliveryDate: invoice.deliveryDate,
          totalGrossCents: data.totalGrossCents,
          totalNetCents: data.totalGrossCents - sumTax(data),
          totalTaxCents: sumTax(data),
          data,
          seed: invoice.seed === true,
        } as never,
        depth: 0,
        overrideAccess: true,
        req,
        context,
      }),
    )
    return { invoice: credit, jobId: await queueRender(req, credit.id) }
  })
}
