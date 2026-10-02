import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import { createLocalReq, type Payload, type PayloadRequest } from 'payload'

import { revalidateProduct } from '@/lib/cache/revalidate'
import { dbFor, type SqlExecutor } from '@/lib/db/tx'
import { sendAdminAlert } from '@/lib/email/alerts'
import { notifyAdmin } from '@/lib/email/notifyAdmin'
import { buildOrderMailData } from '@/lib/email/orderMailData'
import { enqueueEmail, runEmailJobNow } from '@/lib/email/outbox'
import { money } from '@/lib/email/templates/kit'
import type { ActorType } from '@/lib/enums'
import { createInvoiceForOrder } from '@/lib/invoices/create'
import { runInvoicePdfJob } from '@/lib/invoices/issue'
import { jobAlarm } from '@/lib/jobs/alarm'
import { createLogger } from '@/lib/monitoring/logger'
import { preservingReq } from '@/lib/payload/localReq'
import { inTransaction } from '@/lib/payload/transaction'
import { getPaymentsAdapter, type PaymentsAdapter } from '@/lib/payments'
import type { Order } from '@/payload-types'

import { transitionCheckout } from './checkoutTransitions'
import { createOrderFromCheckout } from './createOrderFromCheckout'
import { S17_NOTE } from './fulfillCheckout'
import { intArray, releaseInTransaction } from './reservation'
import { lockOrder, loadOrder, transitionOrder, updateOrderFields } from './transitionOrder'

// Vorkasse (E-23, KONZEPT §4.8, DATENMODELL §8.3/§8.5, PLAN P4.19/P4.20): Bestellen (O2), Erinnerung (M03), automatische
// und manuelle Stornierung (O4), „Zahlung erhalten“ (O3) und „Nachträglich bezahlt“ (O5). Jede Funktion läuft in der
// Transaktion von `req` bzw. einer eigenen und liefert `afterCommit` (Mails direkt ausführen, Beleg-PDF, Cache,
// Weckzeit). Beispiel-Bestellungen (`seed = true`) übergehen die Fristen-Jobs (DATENMODELL §11, KONZEPT §8).

const log = createLogger()

export type PrepaymentErrorCode =
  | 'prepayment_disabled'
  | 'checkout_not_open'
  | 'reservation_lost'
  | 'wrong_status'
  | 'amount_mismatch'
  | 'items_unavailable'
  | 'invalid_input'

export class PrepaymentError extends Error {
  constructor(
    readonly code: PrepaymentErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'PrepaymentError'
  }
}

export interface AfterCommit {
  afterCommit: () => Promise<void>
}

type JobId = number | string | null

async function runMails(payload: Payload, jobs: JobId[], now: Date, event: string): Promise<void> {
  for (const job of jobs) {
    await runEmailJobNow(payload, job, { now }).catch((e: unknown) =>
      log.error(`${event}.mail_failed`, { error: (e as Error)?.message }),
    )
  }
}

function adminItems(order: Order) {
  return order.items.map((i) => ({
    itemNumber: i.itemNumber,
    title: i.titleDe,
    category: i.category,
  }))
}

function productIdsOf(order: Order): number[] {
  return order.items.map((i) => (typeof i.product === 'object' ? i.product.id : i.product))
}

/** Aktive Vorkasse-Reservierung einer Bestellung (Referenz). */
async function prepaymentRef(db: SqlExecutor, orderId: number): Promise<string | null> {
  const res = await db.execute(sql`
    SELECT DISTINCT ref FROM reservations
     WHERE order_id = ${orderId} AND status = 'active' AND source = 'prepayment' LIMIT 1
  `)
  return res.rows[0] ? String(res.rows[0].ref) : null
}

// --- O2: Vorkasse bestellen -------------------------------------------------------------------------------------

export interface PlacePrepaymentOptions {
  now: Date
  /**
   * Eingaben an der Kasse (wie `submitCheckout`, P4.10a): `customer`, Adressen, `legalTextVersions`, … – werden in
   * derselben Transaktion gespeichert; `paymentChoice = prepayment` und `submittedAt = now` setzt der Dienst.
   */
  checkoutData?: Record<string, unknown>
  payments?: PaymentsAdapter
}

export interface PlacePrepaymentResult extends AfterCommit {
  order: Order
  /** Klartext-Token für die Danke-Seite/Status-Link (nie loggen). */
  statusToken: string
}

/**
 * Vorkasse-Abschluss (KONZEPT §5.3 O2, DATENMODELL §8.5) in **einer** Transaktion: Eingaben an der Kasse, Bestellung
 * `awaiting_prepayment`, Reservierung auf `prepayment` umstellen (bis `dueAt`), Kasse `open → completed`, M02 + A02
 * einreihen, keine Rechnung. `afterCommit`: Zahlungs-Session beenden (bei „bezahlt“: S17 – Hinweis + A12), Mails
 * direkt ausführen, `jobAlarm.bump(reminderDueAt)`.
 */
export async function placePrepaymentOrder(
  req: PayloadRequest,
  checkoutId: number,
  options: PlacePrepaymentOptions,
): Promise<PlacePrepaymentResult> {
  const { now } = options
  const at = now.toISOString()
  const tx = await inTransaction(req, async () => {
    const db = await dbFor(req)
    const settings = await preservingReq(req, () =>
      req.payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true, req }),
    )
    if (settings.payment?.prepaymentEnabled !== true) {
      throw new PrepaymentError('prepayment_disabled', 'Vorkasse ist gerade nicht verfügbar.')
    }
    const locked = await db.execute(sql`
      SELECT status, reservation_ref, stripe_checkout_session_id FROM checkouts WHERE id = ${checkoutId} FOR UPDATE
    `)
    const row = locked.rows[0]
    if (!row || row.status !== 'open') {
      throw new PrepaymentError('checkout_not_open', 'Die Kasse ist nicht mehr offen.')
    }
    const ref = String(row.reservation_ref)
    const sessionId = (row.stripe_checkout_session_id as string | null) ?? null

    await preservingReq(req, () =>
      req.payload.update({
        collection: 'checkouts',
        id: checkoutId,
        data: {
          ...(options.checkoutData ?? {}),
          paymentChoice: 'prepayment',
          submittedAt: at,
        } as never,
        depth: 0,
        overrideAccess: true,
        req,
        context: { ...req.context, system: true, now: at },
      }),
    )
    const { order, statusToken } = await createOrderFromCheckout(req, checkoutId, {
      transition: 'O2',
      now,
      actorType: 'customer',
    })
    const dueAt = order.prepayment!.dueAt!
    // §8.5: Reservierung umstellen (Quelle, Frist, Bestellung) – alle Stücke müssen noch mit dieser Referenz reserviert sein
    const items = productIdsOf(order)
    const moved = await db.execute(sql`
      UPDATE products SET reserved_until = ${dueAt}::timestamptz, current_order_id = ${order.id},
                          updated_at = ${at}::timestamptz
       WHERE reservation_ref = ${ref} AND status = 'reserved' AND id = ANY(${intArray(items)})
      RETURNING id
    `)
    if (moved.rows.length !== items.length) {
      throw new PrepaymentError(
        'reservation_lost',
        'Die Reservierung ist abgelaufen – bitte starte die Kasse neu.',
      )
    }
    await db.execute(sql`
      UPDATE reservations SET source = 'prepayment', expires_at = ${dueAt}::timestamptz, order_id = ${order.id},
                              updated_at = ${at}::timestamptz
       WHERE ref = ${ref} AND status = 'active'
    `)
    await transitionCheckout(req, checkoutId, 'completed', { now })

    const mailData = await buildOrderMailData(req, order)
    const m02 = await enqueueEmail(req, {
      template: 'prepayment_instructions',
      to: order.customer.email,
      locale: order.locale,
      data: mailData,
      idempotencyKey: `prepayment_instructions:${order.id}:O2`,
      relations: { order: order.id },
    })
    const a02 = await notifyAdmin(
      req,
      'admin_order_placed',
      {
        orderId: order.id,
        orderNumber: order.orderNumber,
        transition: 'O2',
        totalCents: order.totalCents,
        fulfillmentMethod: order.fulfillmentMethod,
        items: adminItems(order),
        customerName: order.customer?.name ?? null,
        city:
          (order.fulfillmentMethod === 'shipping'
            ? order.shippingAddress?.city
            : order.billingAddress?.city) ?? null,
        paymentMethod: 'prepayment',
        dueAt: new Date(dueAt).toISOString(),
      },
      { idempotencyKey: `admin_order_placed:${order.id}:O2`, relations: { order: order.id } },
    )
    return { order, statusToken, sessionId, jobs: [m02.jobId, a02.jobId] }
  })

  const payload: Payload = req.payload
  const { order } = tx
  return {
    order,
    statusToken: tx.statusToken,
    afterCommit: async () => {
      const jobs: JobId[] = [...tx.jobs]
      if (tx.sessionId) {
        try {
          const payments = options.payments ?? getPaymentsAdapter()
          const result = await payments.expireCheckoutSession(tx.sessionId)
          if (result === 'already_complete_paid') {
            jobs.push(...(await flagPaidDespitePrepayment(payload, order, tx.sessionId, now)))
          }
        } catch (err) {
          // Die Session läuft beim Anbieter ohnehin ab; ein späteres `expired` gibt nichts frei (Quelle `prepayment`).
          log.warn('prepayment.session_expire_failed', {
            orderId: order.id,
            error: (err as Error)?.message,
          })
        }
      }
      await runMails(payload, jobs, now, 'prepayment.placed')
      await jobAlarm.bump(new Date(order.prepayment!.reminderDueAt!))
    },
  }
}

/** S17 nach dem Vorkasse-Abschluss: Kartenzahlung zur Session eingegangen (DATENMODELL §8.8, DM-38). */
async function flagPaidDespitePrepayment(
  payload: Payload,
  order: Order,
  sessionId: string,
  now: Date,
): Promise<JobId[]> {
  const req = await createLocalReq({ context: { system: true, now: now.toISOString() } }, payload)
  return inTransaction(req, async () => {
    await updateOrderFields(
      req,
      order.id,
      { adminAttention: { flag: true, reason: 'manual', note: S17_NOTE } },
      now,
    )
    const alert = await sendAdminAlert(req, {
      kind: 's17_paid_despite_prepayment',
      summary: 'Vorkasse bestellt, aber Karte/PayPal bezahlt – bitte eine Zahlung erstatten',
      affected: `Bestellung ${order.orderNumber}: Betrag ${money(order.totalCents, 'de')}, Session ${sessionId}`,
      automatic: 'Keine zweite Bestellung; die Vorkasse-Bestellung ist markiert.',
      todo: 'Bitte eine der beiden Zahlungen erstatten (Karte/PayPal im Stripe-Dashboard).',
      adminPath: `/collections/orders/${order.id}`,
      now,
    })
    log.warn('prepayment.paid_despite_prepayment', { orderId: order.id })
    return [alert.jobId]
  })
}

// --- O4: stornieren ---------------------------------------------------------------------------------------------

export interface CancelPrepaymentOptions {
  now: Date
  /** `withdrawn`: zugeordneter Widerruf (KONZEPT §5.3 O4/§5.4 W1) – ohne M04/A03, Hinweis steht in M08 (P6.7). */
  reason: 'payment_timeout' | 'admin' | 'withdrawn'
  /** Pflicht bei `admin` (Juttas Text in M04, `cancelNote`). */
  note?: string
  actorType?: ActorType
}

/**
 * O4 aus `awaiting_prepayment` (KONZEPT §5.3): Status `cancelled` (`cancelReason`), Freigabe §8.2
 * (`prepayment_overdue` bzw. `order_cancelled`), M04; A03 nur beim Fristablauf; keine Rechnung.
 */
export async function cancelPrepaymentOrder(
  req: PayloadRequest,
  orderId: number,
  options: CancelPrepaymentOptions,
): Promise<AfterCommit & { order: Order; productIds: number[] }> {
  const { now, reason } = options
  const note = options.note?.trim()
  if (reason === 'admin' && !note) {
    throw new PrepaymentError('invalid_input', 'Bitte kurz begründen, warum storniert wird.')
  }
  const tx = await inTransaction(req, async () => {
    const db = await dbFor(req)
    const { order } = await transitionOrder(req, orderId, 'cancelled', {
      now,
      expectedFrom: ['awaiting_prepayment'],
      actorType: options.actorType,
      note:
        reason === 'admin'
          ? note
          : reason === 'withdrawn'
            ? (note ?? 'Widerruf vor Zahlung')
            : 'Zahlungsfrist abgelaufen',
      data: {
        cancelReason: reason,
        ...(reason === 'admin' ? { cancelNote: note!.slice(0, 300) } : {}),
      },
    })
    const ref = await prepaymentRef(db, orderId)
    const productIds = ref
      ? await releaseInTransaction(req, {
          ref,
          reason: reason === 'payment_timeout' ? 'prepayment_overdue' : 'order_cancelled',
          checkoutId: null,
          now,
        })
      : []
    if (reason === 'withdrawn') return { order, productIds, jobs: [] as JobId[] }
    const base = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customer?.name ?? null,
    }
    const m04 = await enqueueEmail(req, {
      template: 'prepayment_cancelled',
      to: order.customer.email,
      locale: order.locale,
      data: { ...base, reason, ...(reason === 'admin' ? { reasonText: note } : {}) },
      idempotencyKey: `prepayment_cancelled:${order.id}:O4`,
      relations: { order: order.id },
    })
    const jobs: JobId[] = [m04.jobId]
    if (reason === 'payment_timeout') {
      const a03 = await notifyAdmin(
        req,
        'admin_prepayment_cancelled',
        { orderId: order.id, orderNumber: order.orderNumber, items: adminItems(order) },
        {
          idempotencyKey: `admin_prepayment_cancelled:${order.id}:O4`,
          relations: { order: order.id },
        },
      )
      jobs.push(a03.jobId)
    }
    return { order, productIds, jobs }
  })
  const payload: Payload = req.payload
  return {
    order: tx.order,
    productIds: tx.productIds,
    afterCommit: async () => {
      for (const id of tx.productIds) revalidateProduct(id, { immediate: true })
      await runMails(payload, tx.jobs, now, 'prepayment.cancelled')
    },
  }
}

// --- O3/O5: bezahlt ---------------------------------------------------------------------------------------------

export interface MarkPaidOptions {
  now: Date
  /** Eingegangener Betrag in Cent. */
  amountCents: number
  /** Eingangsdatum laut Kontoauszug (Standard `now`). */
  receivedAt?: Date
  /** Betrag ≠ Summe bewusst bestätigt → `adminAttention payment_amount_mismatch`. */
  confirmMismatch?: boolean
  /** `reactivate` = „Nachträglich bezahlt“ (O5) aus `cancelled` mit `payment_timeout`. */
  late?: boolean
  actorType?: ActorType
}

/**
 * O3 (`awaiting_prepayment → paid`, Verkauf über die Vorkasse-Reservierung) bzw. O5 (`cancelled → paid`, nur wenn alle
 * Stücke `available` sind) nach DATENMODELL §8.3: Verkauf, `prepayment.receivedAt`/`receivedAmountCents`,
 * `timestamps.paidAt`, Rechnung, M05.
 */
export async function markPrepaymentPaid(
  orderId: number,
  req: PayloadRequest,
  options: MarkPaidOptions,
): Promise<AfterCommit & { order: Order; transition: 'O3' | 'O5' }> {
  const { now, amountCents } = options
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new PrepaymentError('invalid_input', 'Bitte den eingegangenen Betrag angeben.')
  }
  const receivedAt = options.receivedAt ?? now
  const at = now.toISOString()
  const tx = await inTransaction(req, async () => {
    const db = await dbFor(req)
    const locked = await lockOrder(req, orderId)
    const expected = options.late ? 'cancelled' : 'awaiting_prepayment'
    if (locked.status !== expected) {
      throw new PrepaymentError('wrong_status', `Die Bestellung ist „${locked.status}“.`)
    }
    if (options.late && locked.cancelReason !== 'payment_timeout') {
      throw new PrepaymentError(
        'wrong_status',
        '„Nachträglich bezahlt“ geht nur nach abgelaufener Zahlungsfrist.',
      )
    }
    const before = await loadOrder(req, orderId)
    const mismatch = amountCents !== before.totalCents
    if (mismatch && !options.confirmMismatch) {
      throw new PrepaymentError(
        'amount_mismatch',
        `Eingegangen ${money(amountCents, 'de')}, Bestellsumme ${money(before.totalCents, 'de')} – bitte bestätigen.`,
      )
    }
    const ids = productIdsOf(before)
    const channel = before.fulfillmentMethod === 'pickup' ? 'pickup' : 'online'
    const ref = options.late ? null : await prepaymentRef(db, orderId)
    const sellable = ref
      ? sql`((status = 'reserved' AND reservation_ref = ${ref}) OR status = 'available')`
      : sql`status = 'available'`
    const sold = await db.execute(sql`
      UPDATE products
         SET status = 'sold', sold_at = ${at}::timestamptz, sold_channel = ${channel}::enum_products_sold_channel,
             current_order_id = ${orderId}, reserved_until = NULL, reservation_ref = NULL, updated_at = ${at}::timestamptz
       WHERE id = ANY(${intArray(ids)}) AND ${sellable}
      RETURNING id
    `)
    if (sold.rows.length !== ids.length) {
      // Rollback durch den Fehler: nichts verkauft
      throw new PrepaymentError(
        'items_unavailable',
        'Stück inzwischen verkauft – bitte Geld zurücküberweisen.',
      )
    }
    if (ref) {
      await db.execute(sql`
        UPDATE reservations SET status = 'converted', converted_at = ${at}::timestamptz, updated_at = ${at}::timestamptz
         WHERE ref = ${ref} AND status = 'active'
      `)
    }
    const { order, transition } = await transitionOrder(req, orderId, 'paid', {
      now,
      actorType: options.actorType,
      note: options.late ? 'Nachträglich bezahlt' : undefined,
      data: {
        prepayment: {
          ...(before.prepayment ?? {}),
          receivedAt: receivedAt.toISOString(),
          receivedAmountCents: amountCents,
        },
        timestamps: { ...before.timestamps, paidAt: receivedAt.toISOString() },
        ...(mismatch
          ? {
              adminAttention: {
                flag: true,
                reason: 'payment_amount_mismatch',
                note: `Eingegangen ${amountCents} Cent, Bestellsumme ${before.totalCents} Cent.`,
              },
            }
          : {}),
      },
    })
    const invoice = await createInvoiceForOrder(req, order, { paidAt: receivedAt, now })
    const withInvoice = await loadOrder(req, orderId)
    const m05 = await enqueueEmail(req, {
      template: 'prepayment_received',
      to: withInvoice.customer.email,
      locale: withInvoice.locale,
      data: await buildOrderMailData(req, withInvoice),
      idempotencyKey: `prepayment_received:${orderId}:${transition}`,
      relations: { order: orderId },
    })
    return { order: withInvoice, transition, ids, invoiceJob: invoice.jobId, m05: m05.jobId }
  })
  const payload: Payload = req.payload
  return {
    order: tx.order,
    transition: tx.transition as 'O3' | 'O5',
    afterCommit: async () => {
      await runInvoicePdfJob(payload, tx.invoiceJob, { now }).catch((e: unknown) =>
        log.error('prepayment.invoice_pdf_failed', {
          orderId,
          error: (e as Error)?.message,
        }),
      )
      await runMails(payload, [tx.m05], now, 'prepayment.paid')
      for (const id of tx.ids) revalidateProduct(id, { immediate: true })
    },
  }
}

// --- Fristen-Jobs -----------------------------------------------------------------------------------------------

const sqlOf = (payload: Payload) => (payload.db as unknown as { drizzle: SqlExecutor }).drizzle

export const PREPAYMENT_BATCH = 100

export interface DeadlineRunResult {
  processed: number
  errors: number
  nextDueAt: Date | null
}

/** Nächste Vorkasse-Frist (Erinnerung bzw. Storno) nach `now` – ohne Beispiel-Bestellungen. */
export async function nextPrepaymentWake(payload: Payload, now: Date): Promise<Date | null> {
  const at = now.toISOString()
  const res = await sqlOf(payload).execute(sql`
    SELECT least(
      (SELECT min(prepayment_reminder_due_at) FROM orders
        WHERE status = 'awaiting_prepayment' AND seed IS NOT TRUE AND prepayment_reminder_sent_at IS NULL
          AND prepayment_reminder_due_at > ${at}::timestamptz),
      (SELECT min(prepayment_due_at) + interval '1 second' FROM orders
        WHERE status = 'awaiting_prepayment' AND seed IS NOT TRUE
          AND prepayment_due_at + interval '1 second' > ${at}::timestamptz)
    ) AS next
  `)
  const next = res.rows[0]?.next
  return next ? new Date(next as string | Date) : null
}

async function finishRun(payload: Payload, now: Date, out: DeadlineRunResult) {
  out.nextDueAt = await nextPrepaymentWake(payload, now)
  if (out.nextDueAt) await jobAlarm.bump(out.nextDueAt)
  return out
}

/** Task `prepaymentReminders`: ab `reminderDueAt` genau einmal M03, `reminderSentAt` setzen. */
export async function sendPrepaymentReminders(
  payload: Payload,
  now: Date,
): Promise<DeadlineRunResult> {
  const at = now.toISOString()
  const out: DeadlineRunResult = { processed: 0, errors: 0, nextDueAt: null }
  const due = await sqlOf(payload).execute(sql`
    SELECT id FROM orders
     WHERE status = 'awaiting_prepayment' AND seed IS NOT TRUE AND prepayment_reminder_sent_at IS NULL
       AND prepayment_reminder_due_at <= ${at}::timestamptz AND prepayment_due_at >= ${at}::timestamptz
     ORDER BY prepayment_reminder_due_at LIMIT ${PREPAYMENT_BATCH}
  `)
  for (const row of due.rows) {
    const orderId = Number(row.id)
    try {
      const req = await createLocalReq({ context: { system: true, now: at } }, payload)
      const job = await inTransaction(req, async () => {
        const db = await dbFor(req)
        const locked = await db.execute(sql`
          SELECT status, prepayment_reminder_sent_at FROM orders WHERE id = ${orderId} FOR UPDATE
        `)
        const r = locked.rows[0]
        if (!r || r.status !== 'awaiting_prepayment' || r.prepayment_reminder_sent_at) return null
        const order = await loadOrder(req, orderId)
        const mail = await buildOrderMailData(req, order)
        if (!mail.bank) throw new Error('Bankverbindung fehlt in den Einstellungen (Zahlung).')
        await updateOrderFields(
          req,
          orderId,
          { prepayment: { ...order.prepayment, reminderSentAt: at } },
          now,
        )
        const m03 = await enqueueEmail(req, {
          template: 'prepayment_reminder',
          to: order.customer.email,
          locale: order.locale,
          data: {
            orderId,
            orderNumber: order.orderNumber,
            customerName: order.customer?.name ?? null,
            amountCents: order.totalCents,
            bank: mail.bank,
            dueAt: new Date(order.prepayment!.dueAt!).toISOString(),
          },
          idempotencyKey: `prepayment_reminder:${orderId}:M03`,
          relations: { order: orderId },
        })
        return m03.jobId
      })
      if (job !== null) {
        out.processed += 1
        await runMails(payload, [job], now, 'prepayment.reminder')
      }
    } catch (err) {
      out.errors += 1
      log.error('prepayment.reminder_failed', { orderId, error: (err as Error)?.message })
    }
  }
  return finishRun(payload, now, out)
}

/** Task `cancelOverduePrepayments`: sobald `dueAt < now` O4 (`payment_timeout`), Freigabe, M04 + A03. */
export async function cancelOverduePrepayments(
  payload: Payload,
  now: Date,
): Promise<DeadlineRunResult> {
  const at = now.toISOString()
  const out: DeadlineRunResult = { processed: 0, errors: 0, nextDueAt: null }
  const due = await sqlOf(payload).execute(sql`
    SELECT id FROM orders
     WHERE status = 'awaiting_prepayment' AND seed IS NOT TRUE AND prepayment_due_at < ${at}::timestamptz
     ORDER BY prepayment_due_at LIMIT ${PREPAYMENT_BATCH}
  `)
  for (const row of due.rows) {
    const orderId = Number(row.id)
    try {
      const req = await createLocalReq({ context: { system: true, now: at } }, payload)
      const result = await cancelPrepaymentOrder(req, orderId, {
        now,
        reason: 'payment_timeout',
        actorType: 'job',
      })
      out.processed += 1
      await result.afterCommit()
    } catch (err) {
      out.errors += 1
      log.error('prepayment.cancel_failed', { orderId, error: (err as Error)?.message })
    }
  }
  return finishRun(payload, now, out)
}
