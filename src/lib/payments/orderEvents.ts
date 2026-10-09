import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import type { Payload, PayloadRequest } from 'payload'

import { newRefundEffects } from '@/lib/commerce/refundFinalize'
import { runRefundEffects, setRefundStatus } from '@/lib/commerce/refunds'
import { applyStrayRefundEvent } from '@/lib/commerce/strayPayments'
import { loadOrder, transitionOrder, updateOrderFields } from '@/lib/commerce/transitionOrder'
import { dbFor } from '@/lib/db/tx'
import { sendAdminAlert } from '@/lib/email/alerts'
import { notifyAdmin } from '@/lib/email/notifyAdmin'
import { runEmailJobNow } from '@/lib/email/outbox'
import { money } from '@/lib/email/templates/kit'
import type { OrderStatus, RefundStatus } from '@/lib/enums'
import { createCreditNote } from '@/lib/invoices/create'
import { runInvoicePdfJob } from '@/lib/invoices/issue'
import { createLogger } from '@/lib/monitoring/logger'
import type { Invoice, Order } from '@/payload-types'

import {
  paymentEventData,
  type ChargeRefundedData,
  type DisputeEventData,
  type RefundEventData,
} from './normalize'
import type { PaymentEvent } from './types'

// Erstattungs- und Anfechtungs-Ereignisse (PLAN P4.22, DATENMODELL §6.8.5, KONZEPT §5.3 O16–O18) in der Transaktion von
// `processPaymentEvent`: `refunds[].status` über `stripeRefundId`; `failed` → `adminAttention refund_failed` + A08 (kein
// Statuswechsel); Anfechtung eröffnet → O16, gewonnen → O17, verloren → O18 mit `refunds[]` (`dispute`) und Gutschrift,
// ohne M09. Nicht passende Bestellungen (Vorkasse, anderer Status) → kein Statuswechsel, A12.

const log = createLogger()

export interface OrderEventOutcome {
  status: 'processed' | 'ignored'
  action: string
  orderId?: number | null
  afterCommit?: () => Promise<void>
}

type JobId = number | string | null

/** Ausgangsstatus für O16 (nur Stripe-Zahlungen). */
export const DISPUTABLE_STATUSES: ReadonlySet<OrderStatus> = new Set([
  'paid',
  'packed',
  'shipped',
  'delivered',
  'ready_for_pickup',
  'picked_up',
  'withdrawal_received',
  'return_received',
  'partially_refunded',
])

export const DISPUTE_LOST_NOTE = 'durch Anfechtung erstattet'
export const DISPUTE_WON_NOTE = 'Anfechtung gewonnen'

function mailsAfterCommit(payload: Payload, jobs: JobId[], now: Date, pdfJob: JobId = null) {
  return async () => {
    if (pdfJob !== null) {
      await runInvoicePdfJob(payload, pdfJob, { now }).catch((e: unknown) =>
        log.error('payments.credit_note_pdf_failed', { error: (e as Error)?.message }),
      )
    }
    for (const job of jobs) {
      await runEmailJobNow(payload, job, { now }).catch((e: unknown) =>
        log.error('payments.order_event_mail_failed', { error: (e as Error)?.message }),
      )
    }
  }
}

/** Bestellung zur Zahlung (PaymentIntent bzw. Belastung), gesperrt. */
async function orderForPayment(
  req: PayloadRequest,
  ref: { paymentIntentId?: string | null; chargeId?: string | null },
): Promise<number | null> {
  const db = await dbFor(req)
  const conds = [
    ...(ref.paymentIntentId ? [sql`stripe_payment_intent_id = ${ref.paymentIntentId}`] : []),
    ...(ref.chargeId ? [sql`stripe_charge_id = ${ref.chargeId}`] : []),
  ]
  if (conds.length === 0) return null
  const res = await db.execute(sql`
    SELECT id FROM orders WHERE ${sql.join(conds, sql` OR `)} ORDER BY id LIMIT 1 FOR UPDATE
  `)
  return res.rows[0] ? Number(res.rows[0].id) : null
}

// --- Erstattungen -----------------------------------------------------------------------------------------------

/** `refund.created`/`refund.updated`/`refund.failed`: Status der Erstattung über `stripeRefundId`. */
export async function handleRefundEvent(
  req: PayloadRequest,
  event: PaymentEvent,
  now: Date,
): Promise<OrderEventOutcome> {
  const data = paymentEventData(
    event as PaymentEvent & { type: 'refund.updated' },
  ) as RefundEventData
  const status: RefundStatus = event.type === 'refund.failed' ? 'failed' : data.status
  const db = await dbFor(req)
  const byId = await db.execute(sql`
    SELECT _parent_id AS order_id, _order AS pos FROM orders_refunds WHERE stripe_refund_id = ${data.refundId} LIMIT 1
  `)
  let orderId: number | null = byId.rows[0] ? Number(byId.rows[0].order_id) : null
  let index = -1
  if (orderId !== null) {
    const order = await loadOrder(req, orderId)
    index = (order.refunds ?? []).findIndex((r) => r.stripeRefundId === data.refundId)
  } else {
    // Ereignis vor dem Speichern der Anbieter-ID: offene Erstattung gleichen Betrags ohne ID
    orderId = await orderForPayment(req, data)
    if (orderId !== null) {
      const order = await loadOrder(req, orderId)
      index = (order.refunds ?? []).findIndex(
        (r) => !r.stripeRefundId && r.status === 'pending' && r.amountCents === data.amountCents,
      )
    }
  }
  if (orderId === null || index < 0) {
    // Erstattung einer Zahlung ohne Bestellung (U-58 a) – Stand dort nachtragen; sonst z. B. im Stripe-Dashboard
    // ausgelöst.
    if (orderId === null && (await applyStrayRefundEvent(req, data.refundId, status, now))) {
      return { status: 'processed', action: `stray_refund_${status}`, orderId }
    }
    log.info('payments.refund_unmatched', { refundId: data.refundId, status })
    return { status: 'processed', action: 'refund_unmatched', orderId }
  }
  const effects = newRefundEffects()
  const job = await setRefundStatus(req, orderId, index, {
    status,
    stripeRefundId: data.refundId,
    error: data.failureReason ?? data.providerStatus,
    now,
    effects,
  })
  if (job !== null) effects.mailJobs.push(job)
  const payload = req.payload
  return {
    status: 'processed',
    action: `refund_${status}`,
    orderId,
    afterCommit: () => runRefundEffects(payload, effects, now),
  }
}

/** `charge.refunded`: offene Erstattungen gelten bis zur erstatteten Summe als erfolgreich. */
export async function handleChargeRefunded(
  req: PayloadRequest,
  event: PaymentEvent,
  now: Date,
): Promise<OrderEventOutcome> {
  const data = paymentEventData(
    event as PaymentEvent & { type: 'charge.refunded' },
  ) as ChargeRefundedData
  const orderId = await orderForPayment(req, data)
  if (orderId === null) return { status: 'processed', action: 'refund_unmatched' }
  const order = await loadOrder(req, orderId)
  const refunds = order.refunds ?? []
  let covered = refunds
    .filter((r) => r.status === 'succeeded')
    .reduce((n, r) => n + r.amountCents, 0)
  let changed = 0
  const effects = newRefundEffects()
  for (let i = 0; i < refunds.length; i++) {
    const r = refunds[i]!
    if (r.status !== 'pending' || covered + r.amountCents > data.amountRefundedCents) continue
    covered += r.amountCents
    await setRefundStatus(req, orderId, i, { status: 'succeeded', now, effects })
    changed += 1
  }
  const payload = req.payload
  return {
    status: 'processed',
    action: changed > 0 ? 'refund_succeeded' : 'refund_noop',
    orderId,
    afterCommit: () => runRefundEffects(payload, effects, now),
  }
}

// --- Anfechtungen -----------------------------------------------------------------------------------------------

const reasonCode = (r: string) =>
  r
    .toLowerCase()
    .replace(/[^a-z_]/g, '_')
    .slice(0, 60) || 'general'

async function disputeAlert(
  req: PayloadRequest,
  data: DisputeEventData,
  order: Order | null,
  why: string,
  now: Date,
): Promise<OrderEventOutcome> {
  const alert = await sendAdminAlert(req, {
    kind: 'dispute_not_applicable',
    summary: 'Zahlungsanfechtung ohne passende Bestellung',
    affected: `${order ? `Bestellung ${order.orderNumber} (${order.status}), ` : ''}Anfechtung ${data.disputeId}, Betrag ${money(data.amountCents, 'de')}`,
    automatic: `Kein Statuswechsel (${why}).`,
    todo: 'Bitte die Anfechtung im Stripe-Dashboard prüfen.',
    ...(order ? { adminPath: `/collections/orders/${order.id}` } : {}),
    now,
  })
  log.warn('payments.dispute_not_applicable', { disputeId: data.disputeId, why })
  return {
    status: 'processed',
    action: 'dispute_not_applicable',
    orderId: order?.id ?? null,
    afterCommit: mailsAfterCommit(req.payload, [alert.jobId], now),
  }
}

/** `charge.dispute.created` → O16. */
export async function handleDisputeCreated(
  req: PayloadRequest,
  event: PaymentEvent,
  now: Date,
): Promise<OrderEventOutcome> {
  const data = paymentEventData(
    event as PaymentEvent & { type: 'dispute.created' },
  ) as DisputeEventData
  const orderId = await orderForPayment(req, data)
  const order = orderId === null ? null : await loadOrder(req, orderId)
  if (!order) return disputeAlert(req, data, null, 'keine Bestellung zu dieser Zahlung', now)
  if (order.dispute?.stripeDisputeId === data.disputeId) {
    return { status: 'processed', action: 'dispute_known', orderId: order.id }
  }
  const stripePaid = order.paymentProvider === 'stripe' || order.paymentProvider === 'mock'
  if (!stripePaid || order.paymentMethod === 'prepayment') {
    return disputeAlert(req, data, order, 'Vorkasse-Bestellung', now)
  }
  if (!DISPUTABLE_STATUSES.has(order.status)) {
    return disputeAlert(req, data, order, `Status ${order.status}`, now)
  }
  await transitionOrder(req, order.id, 'disputed', {
    now,
    actorType: 'webhook',
    data: {
      dispute: { status: 'open', stripeDisputeId: data.disputeId },
      adminAttention: {
        flag: true,
        reason: 'dispute_open',
        note: `Zahlung angefochten (${data.reason}), ${money(data.amountCents, 'de')} – bitte Belege im Stripe-Dashboard einreichen.`,
      },
    },
  })
  const a07 = await notifyAdmin(
    req,
    'admin_dispute_opened',
    {
      orderId: order.id,
      orderNumber: order.orderNumber,
      amountCents: data.amountCents,
      reason: reasonCode(data.reason),
      dueBy: null,
    },
    {
      idempotencyKey: `admin_dispute_opened:${order.id}:${data.disputeId}`,
      relations: { order: order.id },
    },
  )
  return {
    status: 'processed',
    action: 'dispute_opened',
    orderId: order.id,
    afterCommit: mailsAfterCommit(req.payload, [a07.jobId], now),
  }
}

/** `charge.dispute.closed` → O17 (gewonnen) bzw. O18 (verloren). */
export async function handleDisputeClosed(
  req: PayloadRequest,
  event: PaymentEvent,
  now: Date,
): Promise<OrderEventOutcome> {
  const data = paymentEventData(
    event as PaymentEvent & { type: 'dispute.closed' },
  ) as DisputeEventData
  const orderId = await orderForPayment(req, data)
  const order = orderId === null ? null : await loadOrder(req, orderId)
  if (!order) return disputeAlert(req, data, null, 'keine Bestellung zu dieser Zahlung', now)
  const known = order.dispute?.stripeDisputeId === data.disputeId
  if (known && (order.dispute?.status === 'won' || order.dispute?.status === 'lost')) {
    return { status: 'processed', action: 'dispute_known', orderId: order.id }
  }
  if (order.status !== 'disputed' || !known) {
    return disputeAlert(req, data, order, `Status ${order.status}`, now)
  }
  if (data.status === 'won') {
    await transitionOrder(req, order.id, order.statusBeforeDispute as OrderStatus, {
      now,
      actorType: 'webhook',
      note: DISPUTE_WON_NOTE,
      data: {
        dispute: { status: 'won', stripeDisputeId: data.disputeId },
        adminAttention: { flag: false, reason: null, note: null },
      },
    })
    return { status: 'processed', action: 'dispute_won', orderId: order.id }
  }
  if (data.status !== 'lost') {
    return disputeAlert(req, data, order, `unbekannter Ausgang „${data.status}“`, now)
  }
  // O18: Erstattung durch die Bank – Eintrag `dispute` (succeeded), Gutschrift zur Rechnung, keine M09
  const refunded = (order.refunds ?? [])
    .filter((r) => r.status === 'succeeded')
    .reduce((n, r) => n + r.amountCents, 0)
  const amountCents = Math.min(data.amountCents, order.totalCents - refunded)
  let creditNoteId: number | null = null
  let pdfJob: JobId = null
  const invoiceId =
    order.invoice === null || order.invoice === undefined
      ? null
      : typeof order.invoice === 'object'
        ? order.invoice.id
        : order.invoice
  if (amountCents > 0 && invoiceId !== null) {
    const invoice = (await req.payload.findByID({
      collection: 'invoices',
      id: invoiceId,
      depth: 0,
      overrideAccess: true,
      req,
    })) as Invoice
    const credit = await createCreditNote(req, invoice, { amountCents, reason: 'dispute', now })
    creditNoteId = credit.invoice.id
    pdfJob = credit.jobId
  }
  if (amountCents > 0) {
    await updateOrderFields(
      req,
      order.id,
      {
        refunds: [
          ...(order.refunds ?? []),
          {
            amountCents,
            reason: 'dispute',
            status: 'succeeded',
            includesShipping: amountCents === order.totalCents,
            ...(creditNoteId ? { creditNote: creditNoteId } : {}),
            createdAt: now.toISOString(),
          },
        ],
      },
      now,
    )
  }
  await transitionOrder(req, order.id, 'refunded', {
    now,
    actorType: 'webhook',
    note: DISPUTE_LOST_NOTE,
    data: { dispute: { status: 'lost', stripeDisputeId: data.disputeId } },
  })
  return {
    status: 'processed',
    action: 'dispute_lost',
    orderId: order.id,
    afterCommit: mailsAfterCommit(req.payload, [], now, pdfJob),
  }
}
