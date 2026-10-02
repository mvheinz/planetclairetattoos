import 'server-only'

import type { Payload } from 'payload'

import type { PaymentMethod, RefundReason, TaxMode } from '@/lib/enums'
import { parseInvoiceData } from '@/lib/invoices/schema'
import { SHIPPING_LINE_DESCRIPTION } from '@/lib/invoices/build'
import { berlinMonthRange } from '@/lib/time'
import type { Invoice, Order } from '@/payload-types'

import { MONTH_KEY_RE } from './format'

// Belege eines Monats für die Exporte (KONZEPT §7.15, R-124, P5.24/P5.25): Rechnungen und Gutschriften der Serien
// RE/GS mit Belegdatum im Berliner Monat, sortiert nach Belegnummer. Beispieldaten (`seed = true`, Serien BSP-RE/BSP-GS)
// sind **immer** ausgeschlossen – auch bei wirksamem `SEED_PREVIEW_MODE`; es gibt keine Option, sie einzuschließen
// (KONZEPT §11.4, ARCHITEKTUR §2.5). Personendaten (Namen, Adressen, E-Mails) werden gar nicht erst geladen.

export type ExportDocumentKind = 'Rechnung' | 'Stornorechnung' | 'Gutschrift'

export interface ExportDocument {
  id: number
  number: string
  type: 'invoice' | 'credit_note'
  kind: ExportDocumentKind
  issueDate: string
  orderNumber: string
  paymentMethod: PaymentMethod
  /** Vorzeichenbehaftet: Gutschriften negativ. */
  grossCents: number
  shippingCents: number
  taxCents: number
  taxMode: TaxMode
  /** Steuersätze der Steuerzeilen (leer im Kleinunternehmer-Modus). */
  rates: number[]
  /** Zahlung bzw. Erstattung (ISO). */
  paidAt: string
  /** Stripe-Zahlungs-ID (Rechnung: Charge, sonst PaymentIntent) bzw. Stripe-Erstattungs-ID (Gutschrift). */
  stripeId: string | null
  status: Invoice['status']
  pdfUploadId: number | null
}

/** Gutschriften wegen Stornierung vor der Lieferung heißen im Export „Stornorechnung“ (KONZEPT §7.15). */
export const CANCELLATION_REASONS: ReadonlySet<RefundReason> = new Set([
  'admin_cancellation',
  'item_unavailable',
])

export class InvalidMonthError extends Error {
  constructor(month: string) {
    super(`Monat im Format JJJJ-MM erwartet, erhalten: ${month}`)
    this.name = 'InvalidMonthError'
  }
}

const idOf = (v: unknown): number | null =>
  v === null || v === undefined
    ? null
    : typeof v === 'object'
      ? Number((v as { id: number }).id)
      : Number(v)

export function monthRange(month: string): { start: Date; end: Date } {
  if (!MONTH_KEY_RE.test(month)) throw new InvalidMonthError(month)
  return berlinMonthRange(month)
}

export async function loadMonthDocuments(
  payload: Payload,
  month: string,
): Promise<ExportDocument[]> {
  const { start, end } = monthRange(month)
  const res = await payload.find({
    collection: 'invoices',
    where: {
      and: [
        { issueDate: { greater_than_equal: start.toISOString() } },
        { issueDate: { less_than: end.toISOString() } },
        { seed: { not_equals: true } },
        { series: { in: ['RE', 'GS'] } },
      ],
    },
    sort: 'number',
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  const invoices = (res.docs as Invoice[])
    .filter((i) => i.seed !== true && !i.number.startsWith('BSP-'))
    .sort((a, b) => (a.number < b.number ? -1 : a.number > b.number ? 1 : 0))
  const orderIds = [...new Set(invoices.map((i) => idOf(i.order)).filter((v) => v !== null))]
  const orders =
    orderIds.length === 0
      ? []
      : ((
          await payload.find({
            collection: 'orders',
            where: { id: { in: orderIds } },
            depth: 0,
            pagination: false,
            overrideAccess: true,
            select: { stripe: true, refunds: true },
          })
        ).docs as Pick<Order, 'id' | 'stripe' | 'refunds'>[])
  const orderById = new Map(orders.map((o) => [o.id, o]))

  return invoices.map((inv): ExportDocument => {
    const data = parseInvoiceData(inv.data)
    const credit = inv.type === 'credit_note'
    const sign = credit ? -1 : 1
    const order = orderById.get(idOf(inv.order)!)
    const shipping =
      data.shipping?.totalCents ??
      data.lines
        .filter((l) => l.description === SHIPPING_LINE_DESCRIPTION)
        .reduce((n, l) => n + l.totalCents, 0)
    const refund = credit
      ? (order?.refunds ?? []).find((r) => idOf(r.creditNote) === inv.id)
      : undefined
    const stripeId = credit
      ? (refund?.stripeRefundId ?? null)
      : (order?.stripe?.chargeId ?? order?.stripe?.paymentIntentId ?? null)
    return {
      id: inv.id,
      number: inv.number,
      type: inv.type,
      kind: !credit
        ? 'Rechnung'
        : inv.reason && CANCELLATION_REASONS.has(inv.reason as RefundReason)
          ? 'Stornorechnung'
          : 'Gutschrift',
      issueDate: inv.issueDate,
      orderNumber: data.orderNumber,
      paymentMethod: data.paymentMethod,
      grossCents: sign * inv.totalGrossCents,
      shippingCents: sign * shipping,
      taxCents: sign * inv.totalTaxCents,
      taxMode: inv.taxMode,
      rates: inv.taxMode === 'kleinunternehmer' ? [] : data.taxLines.map((t) => t.rate),
      paidAt: data.paidAt,
      stripeId: stripeId || null,
      status: inv.status,
      pdfUploadId: idOf(inv.pdf),
    }
  })
}
