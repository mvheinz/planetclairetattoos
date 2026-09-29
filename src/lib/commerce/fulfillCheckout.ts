import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import type { Payload, PayloadRequest } from 'payload'

import { writeAudit } from '@/lib/audit'
import { revalidateProduct } from '@/lib/cache/revalidate'
import { dbFor } from '@/lib/db/tx'
import { sendAdminAlert } from '@/lib/email/alerts'
import { buildOrderMailData } from '@/lib/email/orderMailData'
import { enqueueEmail, runEmailJobNow } from '@/lib/email/outbox'
import type { CheckoutStatus, PaymentProvider } from '@/lib/enums'
import { createInvoiceForOrder } from '@/lib/invoices/create'
import { runInvoicePdfJob } from '@/lib/invoices/issue'
import { money } from '@/lib/email/templates/kit'
import { createLogger } from '@/lib/monitoring/logger'
import { preservingReq } from '@/lib/payload/localReq'
import { inTransaction } from '@/lib/payload/transaction'
import type { SessionState } from '@/lib/payments/types'
import type { Order } from '@/payload-types'

import { transitionCheckout } from './checkoutTransitions'
import { createOrderFromCheckout, type OrderPaymentInput } from './createOrderFromCheckout'
import { executeRefund } from './refunds'
import { intArray } from './reservation'
import { computeShipping, type ShippingSettings } from './shipping'

// Bestellabschluss nach bestätigter Zahlung (DATENMODELL §8.3, KONZEPT §4.10, PLAN P4.16a) – einzige idempotente
// Funktion für Stripe-/Mock-Bestellungen. Aufrufer: Webhook (`processPaymentEvent`), Mock-„Erfolg“, Freigabe mit
// „bereits bezahlt“ (lazy release, `releaseReservation`), später Danke-Seite und Kassenabgleich. Alles in einer
// Transaktion (die des Aufrufers bzw. eine eigene): Kasse sperren → Stücke sperren und prüfen → Bestellung (O1) →
// Verkaufs-SQL → Reservierungen `converted`, Kasse `completed` → Rechnung, M01 + A01 einreihen. Nach dem Commit ruft der
// Aufrufer `afterCommit()` (Beleg-PDF, Mails direkt ausführen, Stückseiten sofort erneuern).

const log = createLogger()

const OPEN: ReadonlySet<CheckoutStatus> = new Set(['open', 'confirming'])

/** Bestätigte Zahlung zu einer Session (aus dem Ereignis bzw. der Anbieter-Abfrage). */
export interface ConfirmedPayment {
  sessionId: string
  provider: Extract<PaymentProvider, 'stripe' | 'mock'>
  paymentIntentId: string | null
  chargeId?: string | null
  /** Zahlart laut Anbieter (Karte ggf. mit Wallet, PayPal). */
  paymentMethod?: SessionState['paymentMethod']
  /** Tatsächlich erhaltener Betrag in Cent (`amount_total` der bezahlten Session). */
  amountReceivedCents: number | null
  livemode: boolean
  paidAt: Date
}

export type FulfillStatus =
  | 'fulfilled'
  /** Bestellung zu dieser Session gibt es schon (Idempotenz). */
  | 'already_fulfilled'
  /** Kasse beendet (`expired`/`cancelled`/`failed`) bzw. anders abgeschlossen – keine Bestellung (S16/S17, P4.16b). */
  | 'checkout_closed'
  | 'paid_despite_prepayment'
  /** S4 (P4.21): alle Stücke fehlen – Bestellung `refunded` (O19), Voll-Erstattung. */
  | 'oversold_refunded'
  /** S4 (P4.21): einige Stücke fehlen – Bestellung `paid` (O1) mit Teil-Erstattung. */
  | 'fulfilled_partially'

export interface FulfillResult {
  status: FulfillStatus
  checkoutId: number
  orderId: number | null
  productIds: number[]
  /** Nach dem Commit: Beleg-PDF und Mails direkt ausführen, Stückseiten sofort erneuern. */
  afterCommit: () => Promise<void>
}

export interface FulfillOptions {
  payment: ConfirmedPayment
  now: Date
}

const noop = async () => undefined

/** Bestätigte Zahlung aus dem Anbieter-Zustand einer bezahlten Session (Rückfälle ohne Ereignis, KONZEPT §4.10). */
export function confirmedPaymentFromSession(
  state: SessionState,
  input: { driver: 'mock' | 'stripe'; livemode: boolean; paidAt: Date },
): ConfirmedPayment {
  return {
    sessionId: state.sessionId,
    provider: input.driver,
    paymentIntentId: state.paymentIntentId ?? null,
    chargeId: state.chargeId ?? null,
    paymentMethod: state.paymentMethod,
    amountReceivedCents: state.amountTotalCents ?? null,
    livemode: input.livemode,
    paidAt: input.paidAt,
  }
}

/** `paymentMethod`/`stripe.paymentMethodType` der Bestellung aus der Zahlart des Anbieters (KONZEPT §4.10 Nr. 3). */
export function orderPaymentMethod(pm: SessionState['paymentMethod']): {
  method: 'card' | 'paypal'
  type: 'card' | 'apple_pay' | 'google_pay' | 'paypal'
} {
  if (pm?.type === 'paypal') return { method: 'paypal', type: 'paypal' }
  return { method: 'card', type: pm?.wallet ?? 'card' }
}

interface LockedCheckout {
  id: number
  status: CheckoutStatus
  ref: string
  orderId: number | null
  fulfillment: 'shipping' | 'pickup'
  totalCents: number
}

async function lockCheckout(req: PayloadRequest, id: number): Promise<LockedCheckout> {
  const db = await dbFor(req)
  const res = await db.execute(sql`
    SELECT id, status, reservation_ref, order_id, fulfillment_method, total_cents
      FROM checkouts WHERE id = ${id} FOR UPDATE
  `)
  const r = res.rows[0]
  if (!r) throw new Error(`Kasse ${id} gibt es nicht.`)
  return {
    id: Number(r.id),
    status: r.status as CheckoutStatus,
    ref: String(r.reservation_ref),
    orderId: r.order_id === null || r.order_id === undefined ? null : Number(r.order_id),
    fulfillment: r.fulfillment_method as 'shipping' | 'pickup',
    totalCents: Number(r.total_cents),
  }
}

/** Notiz an der Vorkasse-Bestellung bei S17 (DATENMODELL §8.8 Nr. 3, DM-38). */
export const S17_NOTE =
  'Vorkasse bestellt, aber Kartenzahlung eingegangen – bitte eine Zahlung erstatten'
/** Kurzbeschreibung der A12 bei S16 (DM-37). */
export const S16_SUMMARY = 'Zahlung zu einer beendeten Kasse – bitte im Stripe-Dashboard erstatten'

/**
 * Nicht-offene Kasse (Schritt 1, KONZEPT §4.10 Nr. 1, §4.11 S16/S17): keine Bestellung, keine Rechnung, Stücke und
 * Kasse unverändert (kein Übergang, DATENMODELL §6.25.3). S16 (`expired`/`cancelled`/`failed`, auch eine andere
 * Bestellung): A12. S17 (Kasse per Vorkasse abgeschlossen): Hinweis `adminAttention` an der Vorkasse-Bestellung + A12.
 * Beide A12-Arten werden nie gedrosselt (`ALWAYS_ALERT_KINDS`).
 */
async function handleClosed(
  req: PayloadRequest,
  checkout: LockedCheckout,
  options: FulfillOptions,
): Promise<FulfillResult> {
  const { payment, now } = options
  const amount =
    payment.amountReceivedCents === null ? 'unbekannt' : money(payment.amountReceivedCents, 'de')
  const ids = `Session ${payment.sessionId}, Zahlung ${payment.paymentIntentId ?? 'unbekannt'}`
  let prepaymentOrder: Order | null = null
  if (checkout.status === 'completed' && checkout.orderId !== null) {
    const order = (await preservingReq(req, () =>
      req.payload.findByID({
        collection: 'orders',
        id: checkout.orderId!,
        depth: 0,
        overrideAccess: true,
        disableErrors: true,
        req,
      }),
    )) as Order | null
    if (order?.paymentMethod === 'prepayment') prepaymentOrder = order
  }

  let alert
  if (prepaymentOrder) {
    await preservingReq(req, () =>
      req.payload.update({
        collection: 'orders',
        id: prepaymentOrder.id,
        data: { adminAttention: { flag: true, reason: 'manual', note: S17_NOTE } } as never,
        depth: 0,
        overrideAccess: true,
        req,
        context: { ...req.context, system: true, now: now.toISOString() },
      }),
    )
    alert = await sendAdminAlert(req, {
      kind: 's17_paid_despite_prepayment',
      summary: 'Vorkasse bestellt, aber Karte/PayPal bezahlt – bitte eine Zahlung erstatten',
      affected: `Bestellung ${prepaymentOrder.orderNumber}: Betrag ${amount}, ${ids}`,
      automatic: 'Keine zweite Bestellung; die Vorkasse-Bestellung ist markiert.',
      todo: 'Bitte eine der beiden Zahlungen erstatten (Karte/PayPal im Stripe-Dashboard).',
      adminPath: `/collections/orders/${prepaymentOrder.id}`,
      now,
    })
  } else {
    alert = await sendAdminAlert(req, {
      kind: 's16_payment_after_checkout_closed',
      summary: S16_SUMMARY,
      affected: `Kasse ${checkout.id} (${checkout.status}): Betrag ${amount}, ${ids}`,
      automatic: 'Keine Bestellung und keine Rechnung; die Stücke sind unverändert.',
      todo: 'Bitte die Zahlung im Stripe-Dashboard prüfen und erstatten.',
      now,
    })
  }
  log.warn('fulfill.checkout_closed', {
    checkoutId: checkout.id,
    status: checkout.status,
    s17: prepaymentOrder !== null,
  })
  const payload: Payload = req.payload
  const jobId = alert.jobId
  return {
    status: prepaymentOrder ? 'paid_despite_prepayment' : 'checkout_closed',
    checkoutId: checkout.id,
    orderId: prepaymentOrder?.id ?? null,
    productIds: [],
    afterCommit: async () => {
      await runEmailJobNow(payload, jobId, { now }).catch((e: unknown) =>
        log.error('fulfill.alert_mail_failed', { error: (e as Error)?.message }),
      )
    },
  }
}

/** Idempotenz: Bestellung zu dieser Session (UNIQUE `orders.stripe_checkout_session_id`). */
async function orderForSession(req: PayloadRequest, sessionId: string): Promise<number | null> {
  const db = await dbFor(req)
  const res = await db.execute(
    sql`SELECT id FROM orders WHERE stripe_checkout_session_id = ${sessionId} LIMIT 1`,
  )
  return res.rows[0] ? Number(res.rows[0].id) : null
}

/**
 * Legt zur bezahlten Session die Bestellung an (DATENMODELL §8.3). Läuft in der Transaktion von `req` bzw. einer
 * eigenen; `afterCommit` erst nach dem Commit aufrufen.
 */
export async function fulfillCheckout(
  checkoutId: number,
  req: PayloadRequest,
  options: FulfillOptions,
): Promise<FulfillResult> {
  const { payment, now } = options
  return inTransaction(req, async () => {
    const db = await dbFor(req)
    // (1) Kasse sperren; Idempotenz; nur `open`/`confirming`
    const checkout = await lockCheckout(req, checkoutId)
    const existing = await orderForSession(req, payment.sessionId)
    if (existing !== null) {
      return {
        status: 'already_fulfilled',
        checkoutId,
        orderId: existing,
        productIds: [],
        afterCommit: noop,
      }
    }
    if (!OPEN.has(checkout.status)) return handleClosed(req, checkout, options)

    // (2) Stücke sperren und prüfen: `reserved` mit dieser Referenz oder `available` → lieferbar
    const rows = await db.execute(sql`
      SELECT product_id FROM checkouts_items WHERE _parent_id = ${checkoutId} ORDER BY _order
    `)
    const productIds = rows.rows.map((r) => Number(r.product_id))
    if (productIds.length === 0) throw new Error(`Kasse ${checkoutId} hat keine Stücke.`)
    const locked = await db.execute(sql`
      SELECT id, status, reservation_ref, category FROM products
       WHERE id = ANY(${intArray(productIds)}) ORDER BY id FOR UPDATE
    `)
    const deliverable = new Set(
      locked.rows
        .filter(
          (p) =>
            (p.status === 'reserved' && p.reservation_ref === checkout.ref) ||
            p.status === 'available',
        )
        .map((p) => Number(p.id)),
    )
    const missing = productIds.filter((id) => !deliverable.has(id))
    const delivered = productIds.filter((id) => deliverable.has(id))
    const categories = new Map(locked.rows.map((p) => [Number(p.id), String(p.category ?? '')]))

    // (3) Bestellung (O1) aus dem Snapshot
    const pm = orderPaymentMethod(payment.paymentMethod)
    const paymentInput: OrderPaymentInput = {
      method: pm.method,
      provider: payment.provider,
      paidAt: payment.paidAt,
      stripe: {
        checkoutSessionId: payment.sessionId,
        paymentIntentId: payment.paymentIntentId,
        chargeId: payment.chargeId ?? null,
        paymentMethodType: pm.type,
        livemode: payment.livemode,
        amountReceivedCents: payment.amountReceivedCents,
      },
    }
    if (delivered.length === 0) {
      return fulfillAllMissing(req, checkout, { ...options, paymentInput, productIds, categories })
    }
    const { order } = await createOrderFromCheckout(req, checkoutId, {
      transition: 'O1',
      payment: paymentInput,
      now,
      actorType: 'webhook',
    })
    const context = { ...req.context, system: true, now: now.toISOString() }
    if (payment.amountReceivedCents !== null && payment.amountReceivedCents !== order.totalCents) {
      await preservingReq(req, () =>
        req.payload.update({
          collection: 'orders',
          id: order.id,
          data: {
            adminAttention: {
              flag: true,
              reason: 'payment_amount_mismatch',
              note: `Erhalten ${payment.amountReceivedCents} Cent, Bestellsumme ${order.totalCents} Cent.`,
            },
          } as never,
          depth: 0,
          overrideAccess: true,
          req,
          context,
        }),
      )
      log.warn('fulfill.amount_mismatch', { orderId: order.id })
    }

    // (4) Verkaufs-SQL §8.3, Reservierungen `converted`, Kasse `completed`
    const at = now.toISOString()
    const channel = checkout.fulfillment === 'pickup' ? 'pickup' : 'online'
    const sold = await db.execute(sql`
      UPDATE products
         SET status = 'sold', sold_at = ${at}::timestamptz, sold_channel = ${channel}::enum_products_sold_channel,
             current_order_id = ${order.id}, reserved_until = NULL, reservation_ref = NULL,
             updated_at = ${at}::timestamptz
       WHERE id = ANY(${intArray(delivered)})
         AND ((status = 'reserved' AND reservation_ref = ${checkout.ref}) OR status = 'available')
      RETURNING id
    `)
    if (sold.rows.length !== delivered.length) {
      throw new Error(
        `Kasse ${checkoutId}: Verkauf unvollständig (${sold.rows.length}/${delivered.length}).`,
      )
    }
    await db.execute(sql`
      UPDATE reservations
         SET status = 'converted', converted_at = ${at}::timestamptz, order_id = ${order.id},
             updated_at = ${at}::timestamptz
       WHERE ref = ${checkout.ref} AND status = 'active' AND product_id = ANY(${intArray(delivered)})
    `)
    await transitionCheckout(req, checkoutId, 'completed', { now })

    // S4 teilweise (§8.4): fehlende Positionen erstatten, Rechnung nur über das Gelieferte
    const partial =
      missing.length > 0 ? await applyPartialOversold(req, order, checkout, { missing, now }) : null

    // (5) Rechnung in derselben Transaktion; M01 und A01 einreihen
    const invoice = await createInvoiceForOrder(req, order, {
      paidAt: payment.paidAt,
      now,
      ...(partial ? { lines: partial.deliveredLineIds, shippingCents: partial.shippingCents } : {}),
    })
    const withInvoice = (await preservingReq(req, () =>
      req.payload.findByID({
        collection: 'orders',
        id: order.id,
        depth: 0,
        overrideAccess: true,
        req,
      }),
    )) as Order
    const mailData = await buildOrderMailData(
      req,
      withInvoice,
      partial ? { unavailable: partial.unavailable } : {},
    )
    const m01 = await enqueueEmail(req, {
      template: 'order_confirmation',
      to: withInvoice.customer.email,
      locale: withInvoice.locale,
      data: mailData,
      idempotencyKey: `order_confirmation:${order.id}:O1`,
      relations: { order: order.id },
    })
    const a01 = await enqueueEmail(req, {
      template: 'admin_order_placed',
      locale: 'de',
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        transition: 'O1',
        totalCents: order.totalCents,
        fulfillmentMethod: order.fulfillmentMethod,
        items: order.items.map((i) => ({
          itemNumber: i.itemNumber,
          title: i.titleDe,
          category: i.category,
        })),
        customerName: order.customer?.name ?? null,
        city:
          (order.fulfillmentMethod === 'shipping'
            ? order.shippingAddress?.city
            : order.billingAddress?.city) ?? null,
        paymentMethod: order.paymentMethod,
        paymentMethodType: pm.type,
      },
      idempotencyKey: `admin_order_placed:${order.id}:O1`,
      relations: { order: order.id },
    })

    const payload: Payload = req.payload
    return {
      status: partial ? 'fulfilled_partially' : 'fulfilled',
      checkoutId,
      orderId: order.id,
      productIds,
      afterCommit: async () => {
        if (partial) {
          await executeRefund(payload, order.id, partial.refundIndex, {
            now,
            reason: 'item_unavailable',
          }).catch((e: unknown) =>
            log.error('fulfill.refund_failed', { orderId: order.id, error: (e as Error)?.message }),
          )
          if (partial.a06)
            await runEmailJobNow(payload, partial.a06, { now }).catch(() => undefined)
        }
        // Beleg-PDF zuerst (Anhang der M01), dann die Mails direkt ausführen, danach Cache.
        await runInvoicePdfJob(payload, invoice.jobId, { now }).catch((e: unknown) =>
          log.error('fulfill.invoice_pdf_failed', {
            orderId: order.id,
            error: (e as Error)?.message,
          }),
        )
        for (const job of [m01.jobId, a01.jobId]) {
          await runEmailJobNow(payload, job, { now }).catch((e: unknown) =>
            log.error('fulfill.mail_failed', { orderId: order.id, error: (e as Error)?.message }),
          )
        }
        for (const id of delivered) {
          revalidateProduct(id, { immediate: true, category: categories.get(id) || null })
        }
      },
    }
  })
}

// --- S4: bezahlt, aber (teilweise) schon weg (DATENMODELL §8.4, KONZEPT §4.10 Nr. 6, PLAN P4.21) -----------------

type OrderItem = Order['items'][number]

const productOf = (i: OrderItem): number =>
  typeof i.product === 'object' ? (i.product as { id: number }).id : (i.product as number)

/** Versand der verbleibenden Stücke (höchste Klasse, Tarif der Zone), höchstens der bezahlte Versand. */
async function remainingShippingCents(req: PayloadRequest, order: Order, remaining: OrderItem[]) {
  if (order.fulfillmentMethod !== 'shipping' || order.shippingCents === 0)
    return order.shippingCents
  const settings = await preservingReq(req, () =>
    req.payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true, req }),
  )
  try {
    const res = computeShipping(
      remaining.map((i) => ({ itemNumber: i.itemNumber, shippingClass: i.shippingClass })),
      'shipping',
      settings as ShippingSettings,
      { country: order.shippingAddress?.country ?? 'DE' },
    )
    return Math.min(order.shippingCents, res.shippingCents)
  } catch (err) {
    // Kein Tarif: vorsichtshalber keine Versand-Erstattung (Jutta sieht den Hinweis `oversold`).
    log.warn('fulfill.remaining_shipping_unknown', {
      orderId: order.id,
      error: (err as Error)?.message,
    })
    return order.shippingCents
  }
}

interface OversoldBooking {
  missingItems: OrderItem[]
  refundCents: number
  includesShipping: boolean
  now: Date
  checkoutRef: string
}

/**
 * Gemeinsamer Teil beider S4-Fälle in der Transaktion: fehlende Positionen `refunded`, `refunds[]`-Eintrag
 * (`item_unavailable`, `pending`), `adminAttention oversold`, Reservierungen der fehlenden Stücke freigeben (sie sind
 * inzwischen anderweitig vergeben), Audit `reservation_conflict`, A06. Liefert Index der Erstattung und A06-Job.
 */
async function bookOversold(
  req: PayloadRequest,
  order: Order,
  b: OversoldBooking,
): Promise<{ refundIndex: number; a06: number | string | null }> {
  const db = await dbFor(req)
  const at = b.now.toISOString()
  const missingIds = new Set(b.missingItems.map((i) => i.id))
  const current = (await preservingReq(req, () =>
    req.payload.findByID({
      collection: 'orders',
      id: order.id,
      depth: 0,
      overrideAccess: true,
      req,
    }),
  )) as Order
  const refunds = [
    ...(current.refunds ?? []),
    {
      amountCents: b.refundCents,
      reason: 'item_unavailable',
      itemIds: b.missingItems.map((i) => i.id),
      includesShipping: b.includesShipping,
      status: 'pending',
      createdAt: at,
    },
  ]
  const itemNumbers = b.missingItems.map((i) => i.itemNumber)
  await preservingReq(req, () =>
    req.payload.update({
      collection: 'orders',
      id: order.id,
      data: {
        items: current.items.map((i) =>
          missingIds.has(i.id) ? { ...i, status: 'refunded', refundedCents: i.priceCents } : i,
        ),
        refunds,
        adminAttention: {
          flag: true,
          reason: 'oversold',
          note: `Schon weg: Nr. ${itemNumbers.join(', ')} – automatisch erstattet: ${money(b.refundCents, 'de')}.`,
        },
      } as never,
      depth: 0,
      overrideAccess: true,
      req,
      context: { ...req.context, system: true, now: at },
    }),
  )
  const missingProducts = b.missingItems.map(productOf)
  await db.execute(sql`
    UPDATE reservations
       SET status = 'released', released_at = ${at}::timestamptz, release_reason = 'admin',
           updated_at = ${at}::timestamptz
     WHERE ref = ${b.checkoutRef} AND status = 'active' AND product_id = ANY(${intArray(missingProducts)})
  `)
  await writeAudit(req, {
    action: 'reservation_conflict',
    entityCollection: 'orders',
    entityId: order.id,
    summary: `Bestellung ${order.orderNumber}: bezahlt, aber Nr. ${itemNumbers.join(', ')} schon weg – ${money(b.refundCents, 'de')} werden erstattet`,
    changes: { missingProducts: [null, missingProducts] },
    actorType: 'webhook',
  })
  const a06 = await enqueueEmail(req, {
    template: 'admin_oversold',
    locale: 'de',
    data: {
      items: b.missingItems.map((i) => ({
        itemNumber: i.itemNumber,
        title: i.titleDe,
        category: i.category,
      })),
      orders: [{ orderId: order.id, orderNumber: order.orderNumber }],
      refundedCents: b.refundCents,
      refundStatus: 'pending',
    },
    idempotencyKey: `admin_oversold:${order.id}`,
    relations: { order: order.id },
  })
  return { refundIndex: refunds.length - 1, a06: a06.jobId }
}

/** S4 teilweise: Bestellung bleibt `paid` (O1); Erstattung = fehlende Stücke + Versanddifferenz. */
async function applyPartialOversold(
  req: PayloadRequest,
  order: Order,
  checkout: LockedCheckout,
  input: { missing: number[]; now: Date },
) {
  const missing = new Set(input.missing)
  const missingItems = order.items.filter((i) => missing.has(productOf(i)))
  const remaining = order.items.filter((i) => !missing.has(productOf(i)))
  const shippingCents = await remainingShippingCents(req, order, remaining)
  const shippingDiff = order.shippingCents - shippingCents
  const refundCents = missingItems.reduce((n, i) => n + i.priceCents, 0) + shippingDiff
  const booked = await bookOversold(req, order, {
    missingItems,
    refundCents,
    includesShipping: shippingDiff > 0,
    now: input.now,
    checkoutRef: checkout.ref,
  })
  return {
    ...booked,
    shippingCents,
    deliveredLineIds: remaining.map((i) => i.id!).filter(Boolean),
    unavailable: missingItems.map((i) => ({
      itemNumber: i.itemNumber,
      refundedCents: i.priceCents,
    })),
  }
}

/** S4 alle fehlen: Bestellung direkt `refunded` (O19), keine Rechnung, Voll-Erstattung, M10 + A06. */
async function fulfillAllMissing(
  req: PayloadRequest,
  checkout: LockedCheckout,
  input: FulfillOptions & {
    paymentInput: OrderPaymentInput
    productIds: number[]
    categories: Map<number, string>
  },
): Promise<FulfillResult> {
  const { now } = input
  const { order } = await createOrderFromCheckout(req, checkout.id, {
    transition: 'O19',
    payment: input.paymentInput,
    now,
    actorType: 'webhook',
  })
  const booked = await bookOversold(req, order, {
    missingItems: order.items,
    refundCents: order.totalCents,
    includesShipping: true,
    now,
    checkoutRef: checkout.ref,
  })
  await transitionCheckout(req, checkout.id, 'completed', { now })
  const m10 = await enqueueEmail(req, {
    template: 'oversold_apology',
    to: order.customer.email,
    locale: order.locale,
    data: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customer?.name ?? null,
      items: order.items.map((i) => ({
        itemNumber: i.itemNumber,
        title: ((order.locale === 'en' ? i.titleEn : null) || i.titleDe).slice(0, 200),
      })),
      refundedCents: order.totalCents,
    },
    idempotencyKey: `oversold_apology:${order.id}:O19`,
    relations: { order: order.id },
  })
  log.warn('fulfill.oversold_all', { orderId: order.id, checkoutId: checkout.id })
  const payload: Payload = req.payload
  return {
    status: 'oversold_refunded',
    checkoutId: checkout.id,
    orderId: order.id,
    productIds: input.productIds,
    afterCommit: async () => {
      await executeRefund(payload, order.id, booked.refundIndex, {
        now,
        reason: 'item_unavailable',
      }).catch((e: unknown) =>
        log.error('fulfill.refund_failed', { orderId: order.id, error: (e as Error)?.message }),
      )
      for (const job of [m10.jobId, booked.a06]) {
        await runEmailJobNow(payload, job, { now }).catch((e: unknown) =>
          log.error('fulfill.mail_failed', { orderId: order.id, error: (e as Error)?.message }),
        )
      }
      for (const id of input.productIds) {
        revalidateProduct(id, { immediate: true, category: input.categories.get(id) || null })
      }
    },
  }
}
