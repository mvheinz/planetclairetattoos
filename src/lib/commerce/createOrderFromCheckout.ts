import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import type { PayloadRequest } from 'payload'

import { idOf } from '@/collections/hooks/commerce'
import { dbFor } from '@/lib/db/tx'
import type {
  ActorType,
  CheckoutStatus,
  OrderStatus,
  PaymentMethod,
  PaymentProvider,
} from '@/lib/enums'
import { preservingReq } from '@/lib/payload/localReq'
import { inTransaction } from '@/lib/payload/transaction'
import { getTaxModeAt } from '@/lib/tax'
import type { Checkout, Media, Order, Product } from '@/payload-types'

import { prepaymentDeadlines } from './deadlines'
import { issueStatusToken } from './statusToken'

// Bestellanlage aus der Kasse (KONZEPT §4, §5.3 O1/O2/O19; DATENMODELL §6.8, §6.25). Einzige Stelle, die
// Bestellungen anlegt (statische Prüfung `order-create`; Ausnahme: Seed). Läuft in der Transaktion des Aufrufers
// (`fulfillCheckout`, `submitCheckout`) bzw. in einer eigenen. Übernimmt den Snapshot der Kasse unverändert; Stücke
// werden nur für Titelbild und Lebensmittelkontakt gelesen. Kassenstatus, Reservierungen, Verkauf, Rechnung und Mails
// bleiben Sache des Aufrufers.

export type CreateOrderTransition = 'O1' | 'O2' | 'O19'

export const ORDER_STATUS_BY_TRANSITION: Readonly<Record<CreateOrderTransition, OrderStatus>> = {
  O1: 'paid',
  O2: 'awaiting_prepayment',
  O19: 'refunded',
}

/** Zahlungsangaben der Bestellung; bei O2 entfällt sie (Vorkasse per Überweisung). */
export interface OrderPaymentInput {
  method: PaymentMethod
  provider: PaymentProvider
  /** Zeitpunkt der bestätigten Zahlung (O1/O19); Standard `now`. */
  paidAt?: Date
  stripe?: {
    checkoutSessionId?: string | null
    paymentIntentId?: string | null
    chargeId?: string | null
    paymentMethodType?: string | null
    livemode?: boolean | null
    amountReceivedCents?: number | null
  }
}

export interface CreateOrderOptions {
  transition: CreateOrderTransition
  payment?: OrderPaymentInput
  now: Date
  /** Auslöser im Statusverlauf; Standard `customer` bei O2, sonst `system`. */
  actorType?: ActorType
}

export type CreateOrderErrorCode =
  'checkout_not_found' | 'not_submitted' | 'order_exists' | 'checkout_closed' | 'payment_invalid'

export class CreateOrderError extends Error {
  constructor(
    readonly code: CreateOrderErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'CreateOrderError'
  }
}

const OPEN_STATES: ReadonlySet<CheckoutStatus> = new Set(['open', 'confirming'])
const ONLINE_METHODS: ReadonlySet<PaymentMethod> = new Set(['card', 'paypal'])
const ONLINE_PROVIDERS: ReadonlySet<PaymentProvider> = new Set(['stripe', 'mock'])

type Doc = Record<string, unknown>

function resolvePayment(options: CreateOrderOptions): OrderPaymentInput {
  const { transition, payment } = options
  if (transition === 'O2') {
    const p = payment ?? { method: 'prepayment', provider: 'bank_transfer' }
    if (p.method !== 'prepayment' || p.provider !== 'bank_transfer') {
      throw new CreateOrderError('payment_invalid', 'Vorkasse (O2) nur als Überweisung.')
    }
    return p
  }
  if (!payment || !ONLINE_METHODS.has(payment.method) || !ONLINE_PROVIDERS.has(payment.provider)) {
    throw new CreateOrderError(
      'payment_invalid',
      `${transition} braucht eine bestätigte Online-Zahlung (Karte/PayPal über Stripe oder Mock).`,
    )
  }
  return payment
}

/** Adressgruppe ohne leere Felder (Payload liefert Gruppen mit `null`-Werten). */
function address(group: Checkout['shippingAddress']): Doc | undefined {
  if (!group) return undefined
  const out = Object.fromEntries(
    Object.entries(group).filter(([, v]) => v !== null && v !== undefined && v !== ''),
  )
  return Object.keys(out).length > 0 ? out : undefined
}

function coverOf(product: Product | undefined): { coverImage?: number; coverImageUrl?: string } {
  const first = product?.images?.[0]
  if (first === undefined || first === null) return {}
  if (typeof first === 'number') return { coverImage: first }
  const media = first as Media
  const url = media.sizes?.card?.url ?? media.url ?? undefined
  return { coverImage: media.id, ...(url ? { coverImageUrl: url } : {}) }
}

async function loadProducts(req: PayloadRequest, ids: number[]): Promise<Map<number, Product>> {
  const res = await preservingReq(req, () =>
    req.payload.find({
      collection: 'products',
      where: { id: { in: ids } },
      pagination: false,
      depth: 1,
      select: { images: true, foodContact: true },
      overrideAccess: true,
      req,
    }),
  )
  return new Map(res.docs.map((p) => [p.id, p as Product]))
}

/**
 * Legt die Bestellung zur Kasse `checkoutId` an (O1 `paid`, O2 `awaiting_prepayment`, O19 `refunded`), mit neuem
 * Status-Token (Hash + Siegel), erstem `statusHistory`-Eintrag und Audit `order_created` (Hook), und setzt
 * `checkouts.order`. Lehnt Kassen ohne `submittedAt`, mit Bestellung oder außerhalb von `open`/`confirming` ab; die
 * Kassenzeile wird dafür gesperrt (`FOR UPDATE`), zusätzlich schützt UNIQUE `orders.checkout_id`.
 * Der Klartext-Token geht nur an die Mail-Daten im Speicher, nie in Logs.
 */
export async function createOrderFromCheckout(
  req: PayloadRequest,
  checkoutId: number,
  options: CreateOrderOptions,
): Promise<{ order: Order; statusToken: string }> {
  const { transition, now } = options
  const status = ORDER_STATUS_BY_TRANSITION[transition]
  if (!status) throw new CreateOrderError('payment_invalid', `Unbekannter Übergang ${transition}.`)
  const payment = resolvePayment(options)

  return inTransaction(req, async () => {
    const db = await dbFor(req)
    const locked = await db.execute(
      sql`SELECT id FROM checkouts WHERE id = ${checkoutId} FOR UPDATE`,
    )
    if (locked.rows.length === 0) {
      throw new CreateOrderError('checkout_not_found', `Kasse ${checkoutId} gibt es nicht.`)
    }
    const checkout = (await preservingReq(req, () =>
      req.payload.findByID({
        collection: 'checkouts',
        id: checkoutId,
        depth: 0,
        overrideAccess: true,
        req,
      }),
    )) as Checkout
    if (!checkout.submittedAt) {
      throw new CreateOrderError('not_submitted', 'Die Kasse wurde noch nicht abgeschickt.')
    }
    if (idOf(checkout.order) !== null) {
      throw new CreateOrderError('order_exists', 'Zu dieser Kasse gibt es schon eine Bestellung.')
    }
    if (!OPEN_STATES.has(checkout.status)) {
      throw new CreateOrderError('checkout_closed', `Die Kasse ist beendet (${checkout.status}).`)
    }

    const settings = await preservingReq(req, () =>
      req.payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true, req }),
    )
    const placedAt = new Date(checkout.submittedAt)
    const shipping = checkout.fulfillmentMethod === 'shipping'
    const differs = shipping && checkout.billingAddressDiffers === true
    const withBilling = !shipping || differs
    const products = await loadProducts(
      req,
      checkout.items.map((i) => idOf(i.product) as number),
    )
    const agreedAt = new Map(
      (checkout.deviationAgreements ?? []).map((a) => [idOf(a.product) as number, a.agreedAt]),
    )

    const items = checkout.items.map((row) => {
      const productId = idOf(row.product) as number
      const product = products.get(productId)
      return {
        product: productId,
        itemNumber: row.itemNumber,
        titleDe: row.titleDe,
        titleEn: row.titleEn ?? undefined,
        category: row.category,
        characteristicsDe: row.characteristicsDe,
        characteristicsEn: row.characteristicsEn ?? undefined,
        priceCents: row.priceCents,
        vatCategory: row.vatCategory,
        shippingClass: row.shippingClass,
        ...coverOf(product),
        ...(product?.foodContact ? { foodContact: product.foodContact } : {}),
        ...(row.deviationText
          ? { deviationText: row.deviationText, deviationAgreedAt: agreedAt.get(productId) }
          : {}),
        status: 'active',
        refundedCents: 0,
      }
    })

    const shippingAddress = shipping ? address(checkout.shippingAddress) : undefined
    const billingAddress = withBilling ? address(checkout.billingAddress) : undefined
    const name = (withBilling ? billingAddress?.name : shippingAddress?.name) as string | undefined
    const paidAt = transition === 'O2' ? undefined : (payment.paidAt ?? now).toISOString()
    const stripe =
      transition === 'O2'
        ? undefined
        : {
            ...(payment.stripe ?? {}),
            checkoutSessionId:
              payment.stripe?.checkoutSessionId ?? checkout.stripe?.checkoutSessionId ?? undefined,
            livemode: payment.stripe?.livemode ?? checkout.stripe?.livemode ?? false,
          }
    const deadlines = transition === 'O2' ? prepaymentDeadlines(placedAt, settings) : undefined
    const issued = issueStatusToken(now)

    const data = {
      status,
      checkout: checkout.id,
      locale: checkout.locale,
      customer: { name, email: checkout.customer?.email },
      fulfillmentMethod: checkout.fulfillmentMethod,
      ...(shippingAddress ? { shippingAddress } : {}),
      billingAddressDiffers: differs,
      ...(billingAddress ? { billingAddress } : {}),
      shippingZone: shipping ? checkout.shippingZone : null,
      shippingClass: checkout.shippingClass,
      items,
      subtotalCents: checkout.subtotalCents,
      shippingCents: checkout.shippingCents,
      totalCents: checkout.totalCents,
      currency: 'EUR',
      taxModeAtOrder: getTaxModeAt(settings, placedAt),
      paymentMethod: payment.method,
      paymentProvider: payment.provider,
      ...(stripe ? { stripe } : {}),
      ...(deadlines
        ? {
            prepayment: {
              dueAt: deadlines.dueAt.toISOString(),
              reminderDueAt: deadlines.reminderDueAt.toISOString(),
            },
          }
        : {}),
      legalTextVersions: checkout.legalTextVersions,
      legalSnippetVersions: checkout.legalSnippetVersions,
      carrierEmailConsent: shipping && checkout.carrierEmailConsent === true,
      timestamps: { placedAt: placedAt.toISOString(), ...(paidAt ? { paidAt } : {}) },
      statusHistory: [
        {
          from: null,
          to: status,
          at: now.toISOString(),
          actorType: options.actorType ?? (transition === 'O2' ? 'customer' : 'system'),
          transition,
        },
      ],
      ...issued.fields,
      seed: checkout.seed === true,
    }

    const context = { ...req.context, system: true, now: now.toISOString() }
    const order = await preservingReq(req, () =>
      req.payload.create({
        collection: 'orders',
        data: data as never,
        depth: 0,
        overrideAccess: true,
        req,
        context: { ...context, transition },
      }),
    )
    await preservingReq(req, () =>
      req.payload.update({
        collection: 'checkouts',
        id: checkout.id,
        data: { order: order.id } as never,
        depth: 0,
        overrideAccess: true,
        req,
        context,
      }),
    )
    return { order, statusToken: issued.token }
  })
}
