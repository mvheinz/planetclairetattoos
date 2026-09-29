import 'server-only'

import { createLocalReq, type Payload, type PayloadRequest } from 'payload'

import { runEmailJobNow } from '@/lib/email/outbox'
import { notifyAdmin } from '@/lib/email/notifyAdmin'
import type { RefundStatus } from '@/lib/enums'
import { createLogger } from '@/lib/monitoring/logger'
import { inTransaction } from '@/lib/payload/transaction'
import { getPaymentsAdapter, type PaymentsAdapter } from '@/lib/payments'
import type { Order } from '@/payload-types'

import { lockOrder, loadOrder, updateOrderFields } from './transitionOrder'

// Erstattungen über den Zahlungsanbieter (DATENMODELL §6.8.5, KONZEPT §4.10 Nr. 6, PLAN P4.21/P4.22): Ausführung nach
// dem Commit mit Idempotenz-Schlüssel `refund:<orderId>:<refundSeq>` (refundSeq = Position in `refunds[]`, ab 1),
// Ergebnis in `refunds[].status`; „fehlgeschlagen“ → `adminAttention refund_failed` + A08 (je Erstattung genau einmal).

const log = createLogger()

type RefundRow = NonNullable<Order['refunds']>[number]

export const refundIdempotencyKey = (orderId: number, refundSeq: number) =>
  `refund:${orderId}:${refundSeq}`

function withRefund(order: Order, index: number, patch: Partial<RefundRow>): RefundRow[] {
  return (order.refunds ?? []).map((r, i) => (i === index ? { ...r, ...patch } : r))
}

/**
 * Setzt Status bzw. Anbieter-ID einer Erstattung in der Transaktion von `req`. Bei `failed` zusätzlich
 * `adminAttention refund_failed` und A08 (Idempotenz je Erstattung). Liefert den Mail-Job (A08) oder `null`.
 */
export async function setRefundStatus(
  req: PayloadRequest,
  orderId: number,
  index: number,
  input: { status: RefundStatus; stripeRefundId?: string | null; error?: string | null; now: Date },
): Promise<number | string | null> {
  return inTransaction(req, async () => {
    await lockOrder(req, orderId)
    const order = await loadOrder(req, orderId)
    const row = order.refunds?.[index]
    if (!row) throw new Error(`Bestellung ${orderId}: Erstattung ${index + 1} gibt es nicht.`)
    const failedNow = input.status === 'failed' && row.status !== 'failed'
    if (
      row.status === input.status &&
      (!input.stripeRefundId || row.stripeRefundId === input.stripeRefundId)
    ) {
      return null
    }
    // Ein endgültiges Ergebnis wird nicht von einem späteren „pending“ überschrieben.
    const status =
      input.status === 'pending' && row.status !== 'pending' ? row.status : input.status
    await updateOrderFields(
      req,
      orderId,
      {
        refunds: withRefund(order, index, {
          status,
          ...(input.stripeRefundId ? { stripeRefundId: input.stripeRefundId } : {}),
        }),
        ...(failedNow
          ? {
              adminAttention: {
                flag: true,
                reason: 'refund_failed',
                note: `Erstattung ${index + 1} fehlgeschlagen${input.error ? `: ${input.error}` : ''}`.slice(
                  0,
                  500,
                ),
              },
            }
          : {}),
      },
      input.now,
    )
    if (!failedNow) return null
    const a08 = await notifyAdmin(
      req,
      'admin_refund_failed',
      {
        orderId,
        orderNumber: order.orderNumber,
        amountCents: row.amountCents,
        error: input.error?.slice(0, 300) ?? null,
      },
      {
        idempotencyKey: `admin_refund_failed:${orderId}:${input.stripeRefundId ?? row.stripeRefundId ?? index + 1}`,
        relations: { order: orderId },
      },
    )
    return a08.jobId
  })
}

export interface ExecuteRefundOptions {
  now: Date
  payments?: PaymentsAdapter
  reason: string
}

/**
 * Führt die Erstattung `refunds[index]` beim Anbieter aus (nach dem Commit der Bestellung). Idempotent über den
 * Schlüssel; ein Anbieterfehler zählt als `failed` (A08), damit Jutta es sieht.
 */
export async function executeRefund(
  payload: Payload,
  orderId: number,
  index: number,
  options: ExecuteRefundOptions,
): Promise<RefundStatus> {
  const { now } = options
  const req = await createLocalReq({ context: { system: true, now: now.toISOString() } }, payload)
  const order = await loadOrder(req, orderId)
  const row = order.refunds?.[index]
  if (!row) throw new Error(`Bestellung ${orderId}: Erstattung ${index + 1} gibt es nicht.`)
  let status: RefundStatus
  let refundId: string | null = null
  let error: string | null = null
  try {
    const paymentIntentId = order.stripe?.paymentIntentId
    if (!paymentIntentId) throw new Error('Keine Zahlung (PaymentIntent) an der Bestellung.')
    const payments = options.payments ?? getPaymentsAdapter()
    const result = await payments.refund({
      paymentIntentId,
      amountCents: row.amountCents,
      reason: options.reason,
      idempotencyKey: refundIdempotencyKey(orderId, index + 1),
    })
    status = result.status
    refundId = result.refundId
  } catch (err) {
    status = 'failed'
    error = (err as Error)?.message ?? String(err)
    log.error('refund.provider_failed', { orderId, refundSeq: index + 1, error })
  }
  const job = await setRefundStatus(req, orderId, index, {
    status,
    stripeRefundId: refundId,
    error,
    now,
  })
  if (job !== null) {
    await runEmailJobNow(payload, job, { now }).catch((e: unknown) =>
      log.error('refund.alert_mail_failed', { orderId, error: (e as Error)?.message }),
    )
  }
  return status
}
