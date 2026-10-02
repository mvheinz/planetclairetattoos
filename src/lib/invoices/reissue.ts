import 'server-only'

import type { PayloadRequest } from 'payload'

import { TASK_DEFS } from '@/jobs/index'
import { getAppContext } from '@/lib/payload/context'
import { preservingReq } from '@/lib/payload/localReq'
import { inTransaction } from '@/lib/payload/transaction'
import type { Invoice, Order } from '@/payload-types'

import { invoiceRecipientAddress, type InvoiceOrder } from './build'
import { createCreditNote } from './create'
import { parseInvoiceData } from './schema'

// Berichtigung nach Rechnungsstellung (PLAN P6.18, R-152, R-121, LOESCHKONZEPT §5.5): Belege werden nie geändert.
// `reissueInvoice` storniert die aktuelle Rechnung der Bestellung mit einer Gutschrift über den vollen Betrag (Grund
// `correction`), übernimmt die berichtigten Angaben in die Bestellung (Kontext `rectify`: auch nach dem Versand, mit
// Vermerk im Verlauf) und stellt eine neue Rechnung mit denselben Positionen und Beträgen aus, die auf die alte
// verweist (`replacesInvoice`, PDF „ersetzt Rechnung …“). Alles in der Transaktion von `req`; die PDF-Jobs führt der
// Aufrufer nach dem Commit aus.

export interface OrderCorrection {
  customerName?: string | null
  customerEmail?: string | null
  shippingAddress?: Partial<NonNullable<Order['shippingAddress']>> | null
  billingAddress?: Partial<NonNullable<Order['billingAddress']>> | null
}

export interface ReissueResult {
  order: Order
  creditNote: Invoice
  invoice: Invoice
  jobs: (number | string)[]
}

const idOf = (v: unknown): number | null =>
  v === null || v === undefined
    ? null
    : typeof v === 'object'
      ? (v as { id: number }).id
      : Number(v)

/** Daten der Bestellung mit den Berichtigungen (nur gesetzte Felder) und einem Vermerk im Verlauf. */
export function correctedOrderData(
  order: Order,
  changes: OrderCorrection,
  note: string,
  now: Date,
): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  if (changes.customerName !== undefined || changes.customerEmail !== undefined) {
    data.customer = {
      ...order.customer,
      ...(changes.customerName !== undefined ? { name: changes.customerName } : {}),
      ...(changes.customerEmail !== undefined ? { email: changes.customerEmail } : {}),
    }
  }
  if (changes.shippingAddress) {
    data.shippingAddress = { ...(order.shippingAddress ?? {}), ...changes.shippingAddress }
  }
  if (changes.billingAddress) {
    data.billingAddress = { ...(order.billingAddress ?? {}), ...changes.billingAddress }
  }
  data.statusHistory = [
    ...(order.statusHistory ?? []),
    {
      from: order.status,
      to: order.status,
      at: now.toISOString(),
      actorType: 'admin',
      note: note.slice(0, 300),
    },
  ]
  return data
}

export async function reissueInvoice(
  req: PayloadRequest,
  orderId: number,
  changes: OrderCorrection,
  options: { now: Date; note: string },
): Promise<ReissueResult> {
  const { now } = options
  return inTransaction(req, async () => {
    const context = { ...req.context, system: true, now: now.toISOString() }
    const order = (await preservingReq(req, () =>
      req.payload.findByID({
        collection: 'orders',
        id: orderId,
        depth: 0,
        overrideAccess: true,
        req,
      }),
    )) as Order
    const invoiceId = idOf(order.invoice)
    if (invoiceId === null) throw new Error('Die Bestellung hat keine Rechnung.')
    const old = (await preservingReq(req, () =>
      req.payload.findByID({
        collection: 'invoices',
        id: invoiceId,
        depth: 0,
        overrideAccess: true,
        req,
      }),
    )) as Invoice
    const oldData = parseInvoiceData(old.data)
    const credit = await createCreditNote(req, old, {
      amountCents: old.totalGrossCents,
      reason: 'correction',
      now,
    })
    const updated = (await preservingReq(req, () =>
      req.payload.update({
        collection: 'orders',
        id: orderId,
        data: correctedOrderData(order, changes, options.note, now) as never,
        depth: 0,
        overrideAccess: true,
        req,
        context: { ...context, transition: 'rectify' },
      }),
    )) as Order
    const address = invoiceRecipientAddress(updated as unknown as InvoiceOrder)
    const data = parseInvoiceData({
      ...oldData,
      buyer: {
        name: address.name,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2 || null,
        postalCode: address.postalCode,
        city: address.city,
        country: address.country ?? 'DE',
        email: updated.customer.email,
      },
      relatedInvoiceNumber: old.number,
    })
    const invoice = (await preservingReq(req, () =>
      req.payload.create({
        collection: 'invoices',
        data: {
          type: 'invoice',
          order: orderId,
          replacesInvoice: old.id,
          deliveryDate: old.deliveryDate,
          totalGrossCents: old.totalGrossCents,
          totalNetCents: old.totalNetCents,
          totalTaxCents: old.totalTaxCents,
          data,
          seed: old.seed === true,
        } as never,
        depth: 0,
        overrideAccess: true,
        req,
        context,
      }),
    )) as Invoice
    const finalOrder = (await preservingReq(req, () =>
      req.payload.update({
        collection: 'orders',
        id: orderId,
        data: { invoice: invoice.id } as never,
        depth: 0,
        overrideAccess: true,
        req,
        context,
      }),
    )) as Order
    const jobs: (number | string)[] = []
    if (credit.jobId !== null) jobs.push(credit.jobId)
    if (!getAppContext(req).seed) {
      const job = await req.payload.jobs.queue({
        task: 'renderInvoicePdf',
        input: { invoiceId: invoice.id },
        queue: TASK_DEFS.renderInvoicePdf.queue,
        req,
      })
      jobs.push(job.id)
    }
    return { order: finalOrder, creditNote: credit.invoice, invoice, jobs }
  })
}
