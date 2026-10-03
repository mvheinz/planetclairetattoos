import 'server-only'

import type { PayloadRequest } from 'payload'

import { createCreditNote, createInvoiceForOrder } from '@/lib/invoices/create'
import { issueInvoicePdf } from '@/lib/invoices/issue'
import type { RefundReason } from '@/lib/enums'
import type { Invoice, Order } from '@/payload-types'

import { seedOp } from './context'
import type { SeedData } from './loader'
import type { SeedReport } from './report'
import { resolveSeedDate } from './time'
import { findBySeedKey } from './upsert'

// Belege des Beispielbestands (SEED-SPEC §9, PLAN P8.4a): Rechnung je bezahlter Bestellung (`issueAt` = Zahlung) und
// Gutschrift je Erstattung (`issueAt` = Erstattung, Grund der Erstattung). Anlage über den normalen Zähler
// (`createInvoiceForOrder`/`createCreditNote`, Serien `BSP-RE`/`BSP-GS` per Hook), je Serie streng nach `issueAt`; das
// PDF rendert der Seed direkt mit dem Renderer aus P4 (Wasserzeichen „BEISPIELBELEG – kein echter Beleg“, ohne Job) und
// legt es als `private-uploads` `invoice-pdf:<Nummer>` ab. Danach `orders.invoice` (macht `createInvoiceForOrder`) und
// `refunds[].creditNote`. Create-only (§1.3).

export interface SeedInvoicePlan {
  seedKey: string
  orderKey: string
  type: 'invoice' | 'credit_note'
  issueAt: Date
  amountCents?: number
  reason?: RefundReason
  /** Index der Erstattung in `orders.refunds` (Gutschrift). */
  refundIndex?: number
}

/** Belege laut §9 in Anlage-Reihenfolge (je Serie nach `issueAt`). */
export function planInvoices(data: SeedData, now: Date): SeedInvoicePlan[] {
  const out: SeedInvoicePlan[] = []
  for (const o of data.orders.orders) {
    const paid = o.timeline.paidAt
    if (!paid) continue
    out.push({
      seedKey: `invoices:${o.key}:invoice`,
      orderKey: o.key,
      type: 'invoice',
      issueAt: resolveSeedDate(paid, now),
    })
    ;(o.refunds ?? []).forEach((r, i) => {
      if (r.status !== 'succeeded') return
      out.push({
        seedKey: `invoices:${o.key}:credit_note:${i + 1}`,
        orderKey: o.key,
        type: 'credit_note',
        issueAt: resolveSeedDate(r.createdAt, now),
        amountCents: r.amountCents,
        reason: r.reason,
        refundIndex: i,
      })
    })
  }
  return out.sort((a, b) => a.issueAt.getTime() - b.issueAt.getTime())
}

/** Führt `fn` mit injizierter Zeit `now` im Kontext von `req` aus (Ausstellungs- und Renderzeit). */
async function at<T>(req: PayloadRequest, now: Date, fn: () => Promise<T>): Promise<T> {
  const before = req.context.now
  req.context.now = now.toISOString()
  try {
    return await fn()
  } finally {
    if (before === undefined) delete req.context.now
    else req.context.now = before
  }
}

export async function importInvoices(
  req: PayloadRequest,
  data: SeedData,
  options: { report: SeedReport; now: Date },
): Promise<void> {
  for (const plan of planInvoices(data, options.now)) {
    const existing = await findBySeedKey(req, 'invoices', plan.seedKey)
    if (existing) {
      options.report.add('invoices', 'unchanged')
      continue
    }
    const orderDoc = await findBySeedKey(req, 'orders', `orders:${plan.orderKey}`)
    if (!orderDoc) throw new Error(`Bestellung orders:${plan.orderKey} fehlt – zuerst orders.`)
    const order = (await req.payload.findByID({
      collection: 'orders',
      id: orderDoc.id,
      ...seedOp(req),
    })) as unknown as Order

    let invoice: Invoice
    if (plan.type === 'invoice') {
      const paidAt = new Date(String(order.timestamps.paidAt))
      ;({ invoice } = await createInvoiceForOrder(req, order, { paidAt, now: plan.issueAt }))
    } else {
      const parentId = typeof order.invoice === 'object' ? order.invoice?.id : order.invoice
      if (!parentId) throw new Error(`${plan.seedKey}: Rechnung der Bestellung fehlt.`)
      const parent = (await req.payload.findByID({
        collection: 'invoices',
        id: parentId,
        ...seedOp(req),
      })) as unknown as Invoice
      ;({ invoice } = await createCreditNote(req, parent, {
        amountCents: plan.amountCents!,
        reason: plan.reason!,
        now: plan.issueAt,
      }))
      // refunds[k].creditNote verknüpfen (§1.7 Schritt 6)
      const refunds = (order.refunds ?? []).map((r, i) =>
        i === plan.refundIndex ? { ...r, creditNote: invoice.id } : r,
      )
      await req.payload.update({
        collection: 'orders',
        id: order.id,
        data: { refunds } as never,
        ...seedOp(req),
      })
    }
    await req.payload.update({
      collection: 'invoices',
      id: invoice.id,
      data: { seedKey: plan.seedKey } as never,
      ...seedOp(req),
    })
    // PDF direkt (ohne Job) mit Wasserzeichen; Datei als private-uploads `invoice-pdf:<Nummer>`
    const issued = await at(req, plan.issueAt, () => issueInvoicePdf(req, invoice.id))
    if (issued.uploadId !== null) {
      await req.payload.update({
        collection: 'private-uploads',
        id: issued.uploadId,
        data: { seedKey: `private-uploads:invoice-pdf:${invoice.number}` } as never,
        ...seedOp(req),
      })
    }
    options.report.add('invoices', 'created')
    options.report.add('private-uploads', 'created')
  }
}
