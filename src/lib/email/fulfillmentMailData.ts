import 'server-only'

import type { Order } from '@/payload-types'

import type { OrderShippedData, PickupReadyData } from './templates/fulfillment'

// Daten der Mails M06 (Versand, P5.15) und M07 (Abholbereit, P5.17) aus dem Snapshot der Bestellung (DM-05): beim
// Einreihen in der Transaktion des Ereignisses bzw. bei „Erneut senden“ (P5.9) aus dem aktuellen Stand gebildet.

const items = (order: Order) =>
  order.items.map((i) => ({
    itemNumber: i.itemNumber,
    title: ((order.locale === 'en' ? i.titleEn : null) || i.titleDe).slice(0, 200),
  }))

const iso = (v: string | null | undefined): string | null => (v ? new Date(v).toISOString() : null)

export class FulfillmentMailError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FulfillmentMailError'
  }
}

/** M06: Versanddienst, Sendungsnummer und Link nur, wenn an der Bestellung gespeichert. */
export function buildShippedMailData(order: Order): OrderShippedData {
  const shippedAt = iso(order.timestamps?.shippedAt)
  const carrier = order.shipment?.carrier
  if (!shippedAt || (carrier !== 'dhl' && carrier !== 'deutsche_post')) {
    throw new FulfillmentMailError('Die Bestellung ist noch nicht als versendet gemeldet.')
  }
  const trackingNumber = order.shipment?.trackingNumber || null
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customer?.name ?? null,
    items: items(order),
    carrier,
    trackingNumber,
    trackingUrl: trackingNumber ? order.shipment?.trackingUrl || null : null,
    shippedAt,
  }
}

/** M07: der an der Bestellung gespeicherte, von Jutta bestätigte Abholtext (`pickup.messageText`). */
export function buildPickupReadyMailData(order: Order): PickupReadyData {
  const messageText = order.pickup?.messageText?.trim()
  if (!messageText) throw new FulfillmentMailError('Zur Bestellung gibt es keinen Abholtext.')
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customer?.name ?? null,
    items: items(order),
    messageText,
  }
}
