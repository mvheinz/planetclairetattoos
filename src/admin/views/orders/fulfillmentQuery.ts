import 'server-only'

import type { PayloadRequest } from 'payload'

import { PICKUP_WAIT_WARN_DAYS, pickupTemplateText } from '@/lib/commerce/pickup'
import { ENUM_LABELS } from '@/lib/enumLabels'
import type { OrderStatus } from '@/lib/enums'
import { formatItemNumber } from '@/lib/products/itemNumber'
import { berlinDateKey, formatBerlin } from '@/lib/time'
import type { Order } from '@/payload-types'

// Daten der Ansichten „Versendet“ `/versendet` (PLAN P5.16, KONZEPT §7.8) und „Abholung“ `/abholung` (PLAN P5.17,
// KONZEPT §7.9). Nur lesend; Aktionen über `src/endpoints/orders/admin.ts`.

const DAY = 86_400_000
const date = (iso: string | null | undefined) =>
  iso ? formatBerlin(new Date(iso), 'dd.MM.yyyy') : ''

const itemsOf = (o: Order) =>
  o.items.map((i) => `${formatItemNumber(i.itemNumber, 'de')} ${i.titleDe}`)

export interface ShippedCard {
  id: number
  orderNumber: string
  status: OrderStatus
  statusLabel: string
  shippedAt: string
  deliveredAt: string | null
  /** Zustellung vom Task `markDelivered` geschätzt. */
  estimated: boolean
  carrier: string | null
  carrierLabel: string | null
  trackingNumber: string | null
  trackingUrl: string | null
  name: string
  items: string[]
}

/** `shipped` (alle) und `delivered` der letzten 30 Tage, neueste Sendung zuerst. */
export async function loadShippedList(req: PayloadRequest, now: Date): Promise<ShippedCard[]> {
  const since = new Date(now.getTime() - 30 * DAY).toISOString()
  const res = await req.payload.find({
    collection: 'orders',
    where: {
      or: [
        { status: { equals: 'shipped' } },
        {
          and: [
            { status: { equals: 'delivered' } },
            { 'timestamps.deliveredAt': { greater_than_equal: since } },
          ],
        },
      ],
    },
    sort: '-timestamps.shippedAt',
    limit: 200,
    depth: 0,
    overrideAccess: true,
    req,
  })
  return (res.docs as Order[]).map((o) => {
    const carrier = o.shipment?.carrier ?? null
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      statusLabel: ENUM_LABELS.ORDER_STATUSES[o.status].de,
      shippedAt: date(o.timestamps?.shippedAt),
      deliveredAt: o.timestamps?.deliveredAt ? date(o.timestamps.deliveredAt) : null,
      estimated: o.shipment?.deliveredSource === 'auto',
      carrier,
      carrierLabel: carrier ? ENUM_LABELS.CARRIERS[carrier].de : null,
      trackingNumber: o.shipment?.trackingNumber ?? null,
      trackingUrl: o.shipment?.trackingUrl ?? null,
      name: o.shippingAddress?.name || o.customer?.name || '',
      items: itemsOf(o),
    }
  })
}

export interface PickupCard {
  id: number
  orderNumber: string
  status: OrderStatus
  statusLabel: string
  placedAt: string
  paidAt: string
  name: string
  items: string[]
  /** Wartetage seit „Bereit zur Abholung“ (sonst seit Zahlung). */
  waitingDays: number
  overdue: boolean
  /** Vorbelegter Abholtext (nur bei `paid`). */
  template: string | null
  messageText: string | null
}

/** Berliner Kalendertage zwischen zwei Zeitpunkten. */
function berlinDaysBetween(from: Date, to: Date): number {
  const a = Date.parse(`${berlinDateKey(from)}T00:00:00Z`)
  const b = Date.parse(`${berlinDateKey(to)}T00:00:00Z`)
  return Math.max(0, Math.round((b - a) / DAY))
}

/** `paid` mit Abholung und `ready_for_pickup`, am längsten wartend zuerst. */
export async function loadPickupList(req: PayloadRequest, now: Date): Promise<PickupCard[]> {
  const res = await req.payload.find({
    collection: 'orders',
    where: {
      and: [
        { fulfillmentMethod: { equals: 'pickup' } },
        { status: { in: ['paid', 'ready_for_pickup'] } },
      ],
    },
    sort: 'timestamps.placedAt',
    limit: 200,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const templates = new Map<string, string>()
  const cards: PickupCard[] = []
  for (const o of res.docs as Order[]) {
    const since = o.timestamps?.readyForPickupAt ?? o.timestamps?.paidAt ?? o.timestamps?.placedAt
    const waitingDays = since ? berlinDaysBetween(new Date(since), now) : 0
    let template: string | null = null
    if (o.status === 'paid') {
      if (!templates.has(o.locale)) {
        templates.set(o.locale, await pickupTemplateText(req, o.locale))
      }
      template = templates.get(o.locale) ?? ''
    }
    cards.push({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      statusLabel: ENUM_LABELS.ORDER_STATUSES[o.status].de,
      placedAt: date(o.timestamps?.placedAt),
      paidAt: date(o.timestamps?.paidAt),
      name: o.billingAddress?.name || o.customer?.name || '',
      items: itemsOf(o),
      waitingDays,
      overdue: o.status === 'ready_for_pickup' && waitingDays > PICKUP_WAIT_WARN_DAYS,
      template,
      messageText: o.pickup?.messageText ?? null,
    })
  }
  return cards.sort((a, b) => b.waitingDays - a.waitingDays)
}
