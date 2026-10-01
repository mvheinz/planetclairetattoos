import 'server-only'

import type { PayloadRequest } from 'payload'

import { carrierEmailConsentActive, shippingAddressLines } from '@/lib/commerce/address'
import {
  packagingForOrder,
  packagingTemplates,
  packingChecklist,
  packingHints,
  withdrawnBeforeShipping,
  type ChecklistItem,
  type PackagingTemplate,
  type PackagingValue,
  type PackingHint,
} from '@/lib/commerce/packing'
import { resendOptions, type ResendOption } from '@/lib/commerce/resendEmail'
import { defaultCarrierFor, type CarrierCode } from '@/lib/carrier'
import { ENUM_LABELS } from '@/lib/enumLabels'
import type { OrderStatus, ShippingClass } from '@/lib/enums'
import { formatItemNumber } from '@/lib/products/itemNumber'
import { formatBerlin } from '@/lib/time'
import type { Order, Setting } from '@/payload-types'

// Daten der Bestell-Ansichten der Verwaltung (PLAN P5.9/P5.10): Bestell-Detail `/bestellungen/:id` und Karten von
// „Zu packen“ `/packen`. Nur lesend; Aktionen laufen über die Endpunkte (`src/endpoints/orders/admin.ts`).

type Doc = Record<string, unknown>

const idOf = (v: unknown): number | null =>
  v === null || v === undefined ? null : typeof v === 'object' ? Number((v as Doc).id) : Number(v)

const berlin = (iso: string | null | undefined, pattern = 'dd.MM.yyyy, HH:mm') =>
  iso ? formatBerlin(new Date(iso), pattern) : ''

export interface ItemCard {
  nr: string
  title: string
  priceCents: number
  thumbUrl: string | null
  productId: number | null
  statusLabel: string
}

export interface PackingCard {
  id: number
  orderNumber: string
  status: OrderStatus
  statusLabel: string
  placedAt: string
  shippingClass: ShippingClass | null
  shippingClassLabel: string | null
  name: string
  city: string
  items: ItemCard[]
  hints: PackingHint[]
  /** Zeilen für „Adresse kopieren“ (E-Mail nur mit wirksamer DHL-Einwilligung). */
  addressLines: string[]
  consentActive: boolean
  consentRevokedAt: string | null
  withdrawn: boolean
}

export interface PhotoCard {
  id: number
  thumbUrl: string | null
  filename: string | null
}

export interface PackingDetail extends PackingCard {
  checklist: ChecklistItem[]
  packaging: PackagingValue & { recorded: boolean; recordedAt: string | null }
  templates: PackagingTemplate[]
  photos: PhotoCard[]
  canPack: boolean
  canShip: boolean
  defaultCarrier: CarrierCode
  trackingNumber: string | null
}

export interface HistoryRow {
  at: string
  from: string | null
  to: string
  actor: string
  transition: string | null
  note: string | null
}

export interface EmailRow {
  id: number
  template: string
  label: string
  subject: string
  at: string
  status: string
  statusLabel: string
}

export interface OrderDetail {
  id: number
  orderNumber: string
  status: OrderStatus
  statusLabel: string
  placedAt: string
  locale: string
  fulfillmentMethod: string
  fulfillmentLabel: string
  paymentLabel: string
  customerName: string
  customerEmail: string
  recipient: string[]
  items: ItemCard[]
  subtotalCents: number
  shippingCents: number
  totalCents: number
  refundedCents: number
  history: HistoryRow[]
  attention: { reason: string | null; note: string | null } | null
  dispute: { status: string; before: string | null } | null
  withdrawalHint: boolean
  notes: string | null
  emails: EmailRow[]
  resend: ResendOption[]
  packing: PackingDetail | null
}

export async function loadSettings(req: PayloadRequest): Promise<Setting> {
  return (await req.payload.findGlobal({
    slug: 'settings',
    depth: 0,
    overrideAccess: true,
    req,
  })) as Setting
}

async function mediaThumbs(req: PayloadRequest, ids: number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>()
  if (ids.length === 0) return out
  const res = await req.payload.find({
    collection: 'media',
    where: { id: { in: ids } },
    pagination: false,
    depth: 0,
    overrideAccess: true,
    req,
  })
  for (const m of res.docs) {
    const url = m.sizes?.thumb?.url ?? m.url
    if (url) out.set(m.id, url)
  }
  return out
}

async function itemCards(req: PayloadRequest, orders: Order[]): Promise<Map<number, ItemCard[]>> {
  const ids = orders.flatMap((o) =>
    o.items.map((i) => idOf(i.coverImage)).filter((x): x is number => !!x),
  )
  const thumbs = await mediaThumbs(req, [...new Set(ids)])
  return new Map(
    orders.map((o) => [
      o.id,
      o.items.map((i) => {
        const cover = idOf(i.coverImage)
        return {
          nr: formatItemNumber(i.itemNumber, 'de'),
          title: i.titleDe,
          priceCents: i.priceCents,
          thumbUrl: (cover ? thumbs.get(cover) : null) ?? i.coverImageUrl ?? null,
          productId: idOf(i.product),
          statusLabel: ENUM_LABELS.ORDER_ITEM_STATUSES[i.status ?? 'active']?.de ?? '',
        }
      }),
    ]),
  )
}

function packingCard(order: Order, items: ItemCard[], settings: Setting): PackingCard {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    statusLabel: ENUM_LABELS.ORDER_STATUSES[order.status].de,
    placedAt: berlin(order.timestamps.placedAt, 'dd.MM.yyyy'),
    shippingClass: order.shippingClass ?? null,
    shippingClassLabel: order.shippingClass
      ? ENUM_LABELS.SHIPPING_CLASSES[order.shippingClass].de
      : null,
    name: order.shippingAddress?.name ?? order.customer?.name ?? '',
    city: order.shippingAddress?.city ?? '',
    items,
    hints: packingHints(order, {
      insuranceThresholdCents: settings.shipping?.insuranceHintThresholdCents,
    }),
    addressLines: shippingAddressLines(order, { includeEmail: true }),
    consentActive: carrierEmailConsentActive(order),
    consentRevokedAt: order.carrierEmailConsentRevokedAt
      ? berlin(order.carrierEmailConsentRevokedAt)
      : null,
    withdrawn: withdrawnBeforeShipping(order),
  }
}

/** Status, die „Zu packen“ zeigt: bezahlt/gepackt, dazu Widerruf vor dem Versand (Hinweis „Nicht mehr versenden“). */
export const PACKING_LIST_STATUSES: readonly OrderStatus[] = [
  'paid',
  'packed',
  'withdrawal_received',
]

/** Karten „Zu packen“: Versandbestellungen `paid`/`packed` (und Widerruf vor dem Versand), älteste zuerst. */
export async function loadPackingList(req: PayloadRequest): Promise<PackingCard[]> {
  const res = await req.payload.find({
    collection: 'orders',
    where: {
      and: [
        { fulfillmentMethod: { equals: 'shipping' } },
        { status: { in: [...PACKING_LIST_STATUSES] } },
      ],
    },
    sort: 'timestamps.placedAt',
    pagination: false,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const orders = (res.docs as Order[]).filter(
    (o) => o.status !== 'withdrawal_received' || withdrawnBeforeShipping(o),
  )
  const settings = await loadSettings(req)
  const cards = await itemCards(req, orders)
  return orders.map((o) => packingCard(o, cards.get(o.id) ?? [], settings))
}

async function packingPhotos(req: PayloadRequest, value: unknown): Promise<PhotoCard[]> {
  const ids = (Array.isArray(value) ? value : []).map(idOf).filter((x): x is number => !!x)
  if (ids.length === 0) return []
  const res = await req.payload.find({
    collection: 'private-uploads',
    where: { id: { in: ids } },
    pagination: false,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const byId = new Map(res.docs.map((d) => [d.id, d]))
  return ids.flatMap((id) => {
    const d = byId.get(id)
    return d
      ? [{ id, thumbUrl: d.sizes?.thumb?.url ?? d.url ?? null, filename: d.filename ?? null }]
      : []
  })
}

export async function loadOrderDetail(req: PayloadRequest, id: number): Promise<OrderDetail | null> {
  const order = (await req.payload.findByID({
    collection: 'orders',
    id,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
    req,
  })) as Order | null
  if (!order) return null
  const settings = await loadSettings(req)
  const items = (await itemCards(req, [order])).get(order.id) ?? []
  const mails = await req.payload.find({
    collection: 'email-log',
    where: { order: { equals: order.id } },
    sort: '-createdAt',
    limit: 50,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const emails: EmailRow[] = mails.docs.map((m) => ({
    id: m.id,
    template: m.template,
    label: ENUM_LABELS.EMAIL_TEMPLATES[m.template]?.de ?? m.template,
    subject: m.subject,
    at: berlin(m.sentAt ?? m.createdAt),
    status: m.status,
    statusLabel: ENUM_LABELS.EMAIL_STATUSES[m.status]?.de ?? m.status,
  }))
  const shipping = order.fulfillmentMethod === 'shipping'
  const packable = shipping && (order.status === 'paid' || order.status === 'packed')
  let packing: PackingDetail | null = null
  if (shipping) {
    const card = packingCard(order, items, settings)
    const packaging = packagingForOrder(order, settings)
    packing = {
      ...card,
      checklist: packingChecklist(order, settings),
      packaging: {
        ...packaging,
        recordedAt: order.packaging?.recordedAt ? berlin(order.packaging.recordedAt) : null,
      },
      templates: packagingTemplates(settings),
      photos: await packingPhotos(req, order.packingPhotos),
      canPack: order.status === 'paid',
      canShip: packable,
      defaultCarrier: (order.shipment?.carrier as CarrierCode | null) ?? defaultCarrierFor(order.shippingClass),
      trackingNumber: order.shipment?.trackingNumber ?? null,
    }
  }
  const refunded = (order.refunds ?? [])
    .filter((r) => r.status === 'succeeded')
    .reduce((n, r) => n + r.amountCents, 0)
  const disputed = order.status === 'disputed' || (order.dispute?.status ?? 'none') !== 'none'
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    statusLabel: ENUM_LABELS.ORDER_STATUSES[order.status].de,
    placedAt: berlin(order.timestamps.placedAt),
    locale: ENUM_LABELS.LOCALES[order.locale].de,
    fulfillmentMethod: order.fulfillmentMethod,
    fulfillmentLabel: ENUM_LABELS.FULFILLMENT_METHODS[order.fulfillmentMethod].de,
    paymentLabel: ENUM_LABELS.PAYMENT_METHODS[order.paymentMethod].de,
    customerName: order.customer?.name ?? '',
    customerEmail: order.customer?.email ?? '',
    recipient: shipping
      ? shippingAddressLines(order)
      : [order.billingAddress?.name ?? order.customer?.name ?? ''].filter(Boolean),
    items,
    subtotalCents: order.subtotalCents,
    shippingCents: order.shippingCents,
    totalCents: order.totalCents,
    refundedCents: refunded,
    history: (order.statusHistory ?? []).map((h) => ({
      at: berlin(h.at),
      from: h.from ? ENUM_LABELS.ORDER_STATUSES[h.from].de : null,
      to: ENUM_LABELS.ORDER_STATUSES[h.to].de,
      actor: ENUM_LABELS.ACTOR_TYPES[h.actorType].de,
      transition: h.transition ?? null,
      note: h.note ?? null,
    })),
    attention: order.adminAttention?.flag
      ? {
          reason: order.adminAttention.reason
            ? ENUM_LABELS.ATTENTION_REASONS[order.adminAttention.reason].de
            : null,
          note: order.adminAttention.note ?? null,
        }
      : null,
    dispute: disputed
      ? {
          status: ENUM_LABELS.DISPUTE_STATUSES[order.dispute?.status ?? 'none'].de,
          before: order.statusBeforeDispute
            ? ENUM_LABELS.ORDER_STATUSES[order.statusBeforeDispute].de
            : null,
        }
      : null,
    withdrawalHint: withdrawnBeforeShipping(order),
    notes: order.notes ?? null,
    emails,
    resend: resendOptions(new Set(mails.docs.map((m) => m.template))),
    packing,
  }
}
