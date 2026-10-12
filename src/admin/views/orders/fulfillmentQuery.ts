import 'server-only'

import type { PayloadRequest } from 'payload'

import {
  deliveryFacts,
  restDeliveryAllowed,
  restPickupPending,
} from '@/lib/commerce/orderTransitions'
import { giftHint, handoverItems } from '@/lib/commerce/packing'
import { PICKUP_WAIT_WARN_DAYS, pickupTemplateText } from '@/lib/commerce/pickup'
import { unassignedWithdrawals } from '@/lib/commerce/withdrawalHold'
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

/** Stücke der Sendung (`handoverItems`: die verschickten, nicht die vorher widerrufenen bzw. erstatteten). */
const itemsOf = (o: Order) =>
  handoverItems(o.items).map((i) => `${formatItemNumber(i.itemNumber, 'de')} ${i.titleDe}`)

export interface ShippedCard {
  id: number
  orderNumber: string
  status: OrderStatus
  statusLabel: string
  shippedAt: string
  deliveredAt: string | null
  /** Zustellung vom Task `markDelivered` geschätzt. */
  estimated: boolean
  /** „Zugestellt“ möglich (`shipped` bzw. Teil-Erstattung während des Transports). */
  canDeliver: boolean
  carrier: string | null
  carrierLabel: string | null
  trackingNumber: string | null
  trackingUrl: string | null
  name: string
  items: string[]
}

/**
 * `shipped` (alle, dazu Teil-Erstattung während des Transports: `partially_refunded` mit `shippedAt` ohne
 * `deliveredAt`) und `delivered` der letzten 30 Tage, neueste Sendung zuerst.
 */
export async function loadShippedList(req: PayloadRequest, now: Date): Promise<ShippedCard[]> {
  const since = new Date(now.getTime() - 30 * DAY).toISOString()
  const res = await req.payload.find({
    collection: 'orders',
    where: {
      or: [
        { status: { equals: 'shipped' } },
        {
          and: [
            { status: { equals: 'partially_refunded' } },
            { 'timestamps.shippedAt': { exists: true } },
            { 'timestamps.deliveredAt': { exists: false } },
          ],
        },
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
      canDeliver:
        o.status === 'shipped' ||
        (o.status === 'partially_refunded' && restDeliveryAllowed('delivered', deliveryFacts(o))),
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
  /** Nächster Schritt: „Bereit zur Abholung“ (`ready`) bzw. „Abgeholt“ (`handover`). */
  step: 'ready' | 'handover'
  placedAt: string
  paidAt: string
  name: string
  /** Nur die Stücke, die übergeben werden (nach Teil-Widerruf/Teil-Erstattung ohne die übrigen). */
  items: string[]
  /** Hinweise in Rot: Stücke, die nicht mehr übergeben werden, bzw. Teil-Widerruf ohne zugeordnete Stücke. */
  warnings: string[]
  /** Aktionen gesperrt (Teil-Widerruf nur im Freitext – erst Stücke zuordnen). */
  blocked: boolean
  /** Wartetage seit „Bereit zur Abholung“ (sonst seit Zahlung). */
  waitingDays: number
  overdue: boolean
  /** Vorbelegter Abholtext (nur bei `paid`). */
  template: string | null
  messageText: string | null
  /** „Geschenk – Karte von Hand schreiben“ samt Gruß (V-18 b), sonst `null`. */
  gift: string | null
}

/** Berliner Kalendertage zwischen zwei Zeitpunkten. */
function berlinDaysBetween(from: Date, to: Date): number {
  const a = Date.parse(`${berlinDateKey(from)}T00:00:00Z`)
  const b = Date.parse(`${berlinDateKey(to)}T00:00:00Z`)
  return Math.max(0, Math.round((b - a) / DAY))
}

/** Nicht mehr zu übergebende Stücke (Teil-Widerruf bzw. Teil-Erstattung vor der Abholung). */
function notHandedOver(o: Order): string[] {
  const out: string[] = []
  const nrs = (statuses: string[]) =>
    o.items
      .filter((i) => statuses.includes(i.status ?? 'active'))
      .map((i) => formatItemNumber(i.itemNumber, 'de'))
  const withdrawn = nrs(['withdrawn', 'returned'])
  if (withdrawn.length > 0) out.push(`Nicht mehr übergeben – Widerruf: ${withdrawn.join(', ')}`)
  const refunded = nrs(['refunded'])
  if (refunded.length > 0) out.push(`Nicht mehr übergeben – erstattet: ${refunded.join(', ')}`)
  return out
}

/**
 * `paid` mit Abholung und `ready_for_pickup` (dazu die Rest-Abholung nach einer Teil-Erstattung vor der Abholung,
 * `partially_refunded`), am längsten wartend zuerst.
 */
export async function loadPickupList(req: PayloadRequest, now: Date): Promise<PickupCard[]> {
  const res = await req.payload.find({
    collection: 'orders',
    where: {
      and: [
        { fulfillmentMethod: { equals: 'pickup' } },
        { status: { in: ['paid', 'ready_for_pickup', 'partially_refunded'] } },
      ],
    },
    sort: 'timestamps.placedAt',
    limit: 200,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const orders = (res.docs as Order[]).filter(
    (o) => o.status !== 'partially_refunded' || restPickupPending(o),
  )
  const unassigned = await unassignedWithdrawals(
    req,
    orders.map((o) => o.id),
  )
  const templates = new Map<string, string>()
  const cards: PickupCard[] = []
  for (const o of orders) {
    const since = o.timestamps?.readyForPickupAt ?? o.timestamps?.paidAt ?? o.timestamps?.placedAt
    const waitingDays = since ? berlinDaysBetween(new Date(since), now) : 0
    const step =
      o.status === 'ready_for_pickup' || o.timestamps?.readyForPickupAt ? 'handover' : 'ready'
    const hold = unassigned.get(o.id) ?? null
    let template: string | null = null
    if (step === 'ready') {
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
      step,
      placedAt: date(o.timestamps?.placedAt),
      paidAt: date(o.timestamps?.paidAt),
      name: o.billingAddress?.name || o.customer?.name || '',
      items: handoverItems(o.items).map(
        (i) => `${formatItemNumber(i.itemNumber, 'de')} ${i.titleDe}`,
      ),
      warnings: [
        ...(hold ? [`Noch nicht übergeben – Teil-Widerruf ${hold}: erst Stücke zuordnen!`] : []),
        ...notHandedOver(o),
      ],
      blocked: !!hold,
      waitingDays,
      overdue: step === 'handover' && waitingDays > PICKUP_WAIT_WARN_DAYS,
      template,
      messageText: o.pickup?.messageText ?? null,
      gift: giftHint(o),
    })
  }
  return cards.sort((a, b) => b.waitingDays - a.waitingDays)
}
