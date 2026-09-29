import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import type { Payload, PayloadRequest } from 'payload'

import { revalidateProduct } from '@/lib/cache/revalidate'
import { dbFor } from '@/lib/db/tx'
import { buildOrderMailData } from '@/lib/email/orderMailData'
import { enqueueEmail, runEmailJobNow } from '@/lib/email/outbox'
import type { CheckoutStatus, PaymentProvider } from '@/lib/enums'
import { createInvoiceForOrder } from '@/lib/invoices/create'
import { runInvoicePdfJob } from '@/lib/invoices/issue'
import { createLogger } from '@/lib/monitoring/logger'
import { preservingReq } from '@/lib/payload/localReq'
import { inTransaction } from '@/lib/payload/transaction'
import { NotImplementedYetError, type SessionState } from '@/lib/payments/types'
import type { Order } from '@/payload-types'

import { transitionCheckout } from './checkoutTransitions'
import { createOrderFromCheckout, type OrderPaymentInput } from './createOrderFromCheckout'
import { intArray } from './reservation'

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

/** Oversold (ein Stück fehlt) – die Behandlung nach DATENMODELL §8.4 folgt mit P4.21. */
export class OversoldNotHandledError extends NotImplementedYetError {
  constructor(readonly productIds: number[]) {
    super('Oversold-Behandlung (fehlende Stücke)', 'P4.21')
  }
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

/**
 * Nicht-offene Kasse (Schritt 1): keine Bestellung, keine Rechnung, Stücke und Kasse unverändert. Meldung an Jutta
 * (A12) und Hinweis an der Vorkasse-Bestellung ergänzt P4.16b.
 */
async function handleClosed(
  _req: PayloadRequest,
  checkout: LockedCheckout,
  _options: FulfillOptions,
): Promise<FulfillResult> {
  log.warn('fulfill.checkout_closed', { checkoutId: checkout.id, status: checkout.status })
  return {
    status: 'checkout_closed',
    checkoutId: checkout.id,
    orderId: checkout.orderId,
    productIds: [],
    afterCommit: noop,
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
    const deliverable = locked.rows.filter(
      (p) =>
        (p.status === 'reserved' && p.reservation_ref === checkout.ref) || p.status === 'available',
    )
    if (deliverable.length < productIds.length) {
      const ok = new Set(deliverable.map((p) => Number(p.id)))
      throw new OversoldNotHandledError(productIds.filter((id) => !ok.has(id)))
    }
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
       WHERE id = ANY(${intArray(productIds)})
         AND ((status = 'reserved' AND reservation_ref = ${checkout.ref}) OR status = 'available')
      RETURNING id
    `)
    if (sold.rows.length !== productIds.length) {
      throw new Error(
        `Kasse ${checkoutId}: Verkauf unvollständig (${sold.rows.length}/${productIds.length}).`,
      )
    }
    await db.execute(sql`
      UPDATE reservations
         SET status = 'converted', converted_at = ${at}::timestamptz, order_id = ${order.id},
             updated_at = ${at}::timestamptz
       WHERE ref = ${checkout.ref} AND status = 'active'
    `)
    await transitionCheckout(req, checkoutId, 'completed', { now })

    // (5) Rechnung in derselben Transaktion; M01 und A01 einreihen
    const invoice = await createInvoiceForOrder(req, order, { paidAt: payment.paidAt, now })
    const withInvoice = (await preservingReq(req, () =>
      req.payload.findByID({
        collection: 'orders',
        id: order.id,
        depth: 0,
        overrideAccess: true,
        req,
      }),
    )) as Order
    const mailData = await buildOrderMailData(req, withInvoice)
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
      status: 'fulfilled',
      checkoutId,
      orderId: order.id,
      productIds,
      afterCommit: async () => {
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
        for (const id of productIds) {
          revalidateProduct(id, { immediate: true, category: categories.get(id) || null })
        }
      },
    }
  })
}
