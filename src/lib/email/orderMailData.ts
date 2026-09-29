import 'server-only'

import type { PayloadRequest } from 'payload'

import { legalAttachmentInfo } from '@/lib/legal/attachments'
import { preservingReq } from '@/lib/payload/localReq'
import type { Invoice, Order, Setting } from '@/payload-types'

import type { MailAddress, OrderMailData } from './templates/orderSections'

// Daten der Bestellmails M01/M02/M05 aus dem Snapshot der Bestellung (DM-05) und den Einstellungen (KONZEPT §6.3):
// entstehen beim Einreihen in der Transaktion des Ereignisses und gehen nur in die Job-Eingabe (Outbox, P4.13).

const idOf = (v: unknown): number | null =>
  v === null || v === undefined
    ? null
    : typeof v === 'object'
      ? (v as { id: number }).id
      : Number(v)

function address(
  a: Order['shippingAddress'] | Order['billingAddress'] | null | undefined,
): MailAddress | null {
  if (!a) return null
  const out: MailAddress = {
    name: a.name ?? null,
    addressLine1: a.addressLine1 ?? null,
    addressLine2: a.addressLine2 ?? null,
    postalCode: a.postalCode ?? null,
    city: a.city ?? null,
    country: a.country ?? null,
  }
  return Object.values(out).some((v) => v) ? out : null
}

export interface OrderMailExtras {
  /** S4 (P4.21): fehlende Stücke mit erstattetem Betrag. */
  unavailable?: { itemNumber: number; refundedCents: number }[]
}

/** Bestellmail-Daten für M01/M02/M05 (Anhangsnamen für M01: Rechnung + Rechtstexte, M02: Rechtstexte, M05: Rechnung). */
export async function buildOrderMailData(
  req: PayloadRequest,
  order: Order,
  extras: OrderMailExtras = {},
): Promise<OrderMailData> {
  const locale = order.locale
  const settings = (await preservingReq(req, () =>
    req.payload.findGlobal({ slug: 'settings', locale, depth: 0, overrideAccess: true, req }),
  )) as Setting
  const legal = await legalAttachmentInfo(req, order)
  const invoiceId = idOf(order.invoice)
  const invoice =
    invoiceId === null
      ? null
      : ((await preservingReq(req, () =>
          req.payload.findByID({
            collection: 'invoices',
            id: invoiceId,
            depth: 0,
            overrideAccess: true,
            req,
          }),
        )) as Invoice)
  const invoiceNumber = invoice?.number ?? null
  const payment = settings.payment ?? {}
  const prepayment = order.paymentMethod === 'prepayment'
  const bank =
    prepayment && payment.accountHolder && payment.iban
      ? {
          accountHolder: payment.accountHolder,
          iban: payment.iban,
          bic: payment.bic ?? null,
          bankName: payment.bankName ?? null,
        }
      : null
  const shipping = order.fulfillmentMethod === 'shipping'
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    placedAt: new Date(order.timestamps.placedAt).toISOString(),
    customerName: order.customer?.name ?? null,
    items: order.items
      .filter((i) => !(extras.unavailable ?? []).some((u) => u.itemNumber === i.itemNumber))
      .map((i) => ({
        itemNumber: i.itemNumber,
        title: (locale === 'en' ? i.titleEn : null) || i.titleDe,
        characteristics: (locale === 'en' ? i.characteristicsEn : null) || i.characteristicsDe,
        priceCents: i.priceCents,
        deviationText: i.deviationText ?? null,
      })),
    fulfillmentMethod: order.fulfillmentMethod,
    shippingCents: order.shippingCents,
    totalCents: order.totalCents,
    taxMode: order.taxModeAtOrder,
    paymentMethod: order.paymentMethod,
    paymentMethodType: order.stripe?.paymentMethodType ?? null,
    paidAt: order.timestamps.paidAt ? new Date(order.timestamps.paidAt).toISOString() : null,
    shippingAddress: shipping ? address(order.shippingAddress) : null,
    billingAddress: !shipping || order.billingAddressDiffers ? address(order.billingAddress) : null,
    deliveryTime: settings.shipping?.deliveryTimeText ?? null,
    legal: { agb: legal.agb, withdrawal: legal.withdrawal },
    attachmentFiles: [...(invoiceNumber ? [`${invoiceNumber}.pdf`] : []), ...legal.files],
    invoiceNumber,
    carrierEmailConsent: shipping && order.carrierEmailConsent === true,
    unavailable: extras.unavailable ?? [],
    bank,
    dueAt: order.prepayment?.dueAt ? new Date(order.prepayment.dueAt).toISOString() : null,
  }
}
