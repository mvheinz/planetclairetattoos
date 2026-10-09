import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import type { Payload, PayloadRequest } from 'payload'

import { writeAudit } from '@/lib/audit'
import { dbFor } from '@/lib/db/tx'
import { money } from '@/lib/email/templates/kit'
import { createLogger } from '@/lib/monitoring/logger'
import { preservingReq } from '@/lib/payload/localReq'
import { inTransaction } from '@/lib/payload/transaction'
import { getPaymentsAdapter, type PaymentsAdapter } from '@/lib/payments'
import type { Checkout } from '@/payload-types'

import {
  strayRefundIdempotencyKey,
  strayRefundOpen,
  type StrayPaymentKind,
  type StrayRefundStatus,
} from './strayPaymentRules'

// Zahlungen ohne eigene Bestellung (U-58 a, J-26/J-27, KONZEPT §4.11 S16/S17): Der Webhook legt keine Bestellung an,
// merkt sich die Zahlung aber an der Kasse (`checkouts.strayPayments`). In der Verwaltung („Heute“ bzw. an der
// Vorkasse-Bestellung) erstattet Jutta sie mit einem Knopf über den vorhandenen Erstattungs-Adapter
// (`PaymentsAdapter.refund`, PAYMENTS_DRIVER=mock bis P11). Idempotent: ein Idempotenz-Schlüssel je Zahlung und
// Versuch beim Anbieter, „läuft“/„erstattet“ → `{ unchanged: true }`; jeder Versuch steht im Audit-Log.

const log = createLogger()

type StrayRow = NonNullable<Checkout['strayPayments']>[number]

export class StrayRefundError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'StrayRefundError'
  }
}

async function loadCheckout(req: PayloadRequest, id: number): Promise<Checkout | null> {
  return (await preservingReq(req, () =>
    req.payload.findByID({
      collection: 'checkouts',
      id,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
      req,
    }),
  )) as Checkout | null
}

async function writeRows(req: PayloadRequest, id: number, rows: StrayRow[], now: Date) {
  await preservingReq(req, () =>
    req.payload.update({
      collection: 'checkouts',
      id,
      data: { strayPayments: rows } as never,
      depth: 0,
      overrideAccess: true,
      req,
      context: { ...req.context, system: true, now: now.toISOString() },
    }),
  )
}

/**
 * Zahlung ohne Bestellung an der Kasse vermerken (in der Transaktion des Webhooks). Ohne PaymentIntent nichts (dann
 * hilft nur das Stripe-Dashboard, die Verwaltungs-Mail A12 nennt die IDs); dieselbe Zahlung nie doppelt.
 */
export async function recordStrayPayment(
  req: PayloadRequest,
  checkoutId: number,
  input: {
    kind: StrayPaymentKind
    paymentIntentId: string | null
    sessionId: string | null
    amountCents: number | null
    now: Date
  },
): Promise<boolean> {
  if (!input.paymentIntentId) return false
  const checkout = await loadCheckout(req, checkoutId)
  if (!checkout) return false
  const rows = checkout.strayPayments ?? []
  if (rows.some((r) => r.paymentIntentId === input.paymentIntentId)) return false
  await writeRows(
    req,
    checkoutId,
    [
      ...rows,
      {
        kind: input.kind,
        paymentIntentId: input.paymentIntentId,
        sessionId: input.sessionId,
        amountCents: input.amountCents,
        receivedAt: input.now.toISOString(),
        refundStatus: 'none',
        refundAttempts: 0,
      },
    ],
    input.now,
  )
  return true
}

export interface StrayPaymentView {
  checkoutId: number
  orderId: number | null
  kind: StrayPaymentKind
  paymentIntentId: string
  amountCents: number | null
  receivedAt: string
  refundStatus: StrayRefundStatus
  refundedAt: string | null
}

/** Für die Verwaltung: offene (bzw. alle) Zahlungen ohne Bestellung, neueste zuerst; optional nur einer Bestellung. */
export async function listStrayPayments(
  payload: Payload,
  options: { orderId?: number; openOnly?: boolean } = {},
): Promise<StrayPaymentView[]> {
  const res = await payload.find({
    collection: 'checkouts',
    where: {
      and: [
        { 'strayPayments.paymentIntentId': { exists: true } },
        ...(options.orderId !== undefined ? [{ order: { equals: options.orderId } }] : []),
      ],
    },
    depth: 0,
    limit: 100,
    pagination: false,
    overrideAccess: true,
    select: { strayPayments: true, order: true },
  })
  const out: StrayPaymentView[] = []
  for (const c of res.docs) {
    for (const r of c.strayPayments ?? []) {
      const status = (r.refundStatus ?? 'none') as StrayRefundStatus
      if (options.openOnly && !strayRefundOpen(status) && status !== 'pending') continue
      out.push({
        checkoutId: c.id,
        orderId: typeof c.order === 'number' ? c.order : (c.order?.id ?? null),
        kind: r.kind as StrayPaymentKind,
        paymentIntentId: r.paymentIntentId,
        amountCents: r.amountCents ?? null,
        receivedAt: r.receivedAt,
        refundStatus: status,
        refundedAt: r.refundedAt ?? null,
      })
    }
  }
  return out.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
}

export interface StrayRefundResult {
  unchanged: boolean
  status: StrayRefundStatus
  refundId: string | null
}

/**
 * Erstattet eine Zahlung ohne Bestellung in voller Höhe (nur Verwaltung, Aufrufer prüft `isAdmin`). Zielzustand
 * schon erreicht („läuft“/„erstattet“) → `unchanged`. Anbieterfehler → „fehlgeschlagen“ (erneut versuchbar) und Fehler.
 */
export async function refundStrayPayment(
  req: PayloadRequest,
  input: { checkoutId: number; paymentIntentId: string; now: Date; payments?: PaymentsAdapter },
): Promise<StrayRefundResult> {
  const { checkoutId, paymentIntentId, now } = input
  const checkout = await loadCheckout(req, checkoutId)
  const row = checkout?.strayPayments?.find((r) => r.paymentIntentId === paymentIntentId)
  if (!checkout || !row) throw new StrayRefundError(404, 'Diese Zahlung gibt es nicht (mehr).')
  const before = (row.refundStatus ?? 'none') as StrayRefundStatus
  if (!strayRefundOpen(before)) {
    return { unchanged: true, status: before, refundId: row.refundId ?? null }
  }
  if (typeof row.amountCents !== 'number' || row.amountCents <= 0) {
    throw new StrayRefundError(
      409,
      'Der Betrag dieser Zahlung ist unbekannt – bitte im Stripe-Dashboard erstatten.',
    )
  }
  const attempt = (row.refundAttempts ?? 0) + 1
  let status: StrayRefundStatus
  let refundId: string | null = null
  let error: string | null = null
  try {
    const payments = input.payments ?? getPaymentsAdapter()
    const result = await payments.refund({
      paymentIntentId,
      amountCents: row.amountCents,
      reason: row.kind === 'double' ? 'duplicate' : 'requested_by_customer',
      idempotencyKey: strayRefundIdempotencyKey(paymentIntentId, attempt),
    })
    status = result.status
    refundId = result.refundId
  } catch (err) {
    status = 'failed'
    error = (err as Error)?.message ?? String(err)
    log.error('stray_refund.provider_failed', { checkoutId, error })
  }

  await inTransaction(req, async () => {
    const db = await dbFor(req)
    await db.execute(sql`SELECT id FROM checkouts WHERE id = ${checkoutId} FOR UPDATE`)
    const fresh = await loadCheckout(req, checkoutId)
    const rows = (fresh?.strayPayments ?? []).map((r) =>
      r.paymentIntentId === paymentIntentId
        ? {
            ...r,
            refundStatus: status,
            refundAttempts: Math.max(r.refundAttempts ?? 0, attempt),
            ...(refundId ? { refundId } : {}),
            ...(status === 'succeeded' ? { refundedAt: now.toISOString() } : {}),
          }
        : r,
    )
    await writeRows(req, checkoutId, rows, now)
    await writeAudit(req, {
      action: 'stray_payment_refunded',
      entityCollection: 'checkouts',
      entityId: checkoutId,
      summary:
        `Zahlung ohne Bestellung (${row.kind === 'double' ? 'zusätzlich zur Vorkasse' : 'nach Ende der Kasse'}) über ${money(row.amountCents!, 'de')}: Erstattung ${status}${error ? ` – ${error}` : ''}`.slice(
          0,
          500,
        ),
      changes: { refundStatus: [before, status], attempt: [attempt - 1, attempt] },
    })
  })
  if (status === 'failed') {
    throw new StrayRefundError(
      502,
      `Die Erstattung hat nicht geklappt${error ? ` (${error.slice(0, 200)})` : ''}. Bitte später noch einmal versuchen oder im Stripe-Dashboard erstatten.`,
    )
  }
  return { unchanged: false, status, refundId }
}

/** Erstattungs-Ereignis ohne passende Bestellung (Webhook): Stand an der Zahlung ohne Bestellung nachtragen. */
export async function applyStrayRefundEvent(
  req: PayloadRequest,
  refundId: string,
  status: StrayRefundStatus,
  now: Date,
): Promise<boolean> {
  const db = await dbFor(req)
  const refundedAt = status === 'succeeded' ? now.toISOString() : null
  const res = await db.execute(sql`
    UPDATE checkouts_stray_payments
       SET refund_status = ${status}, refunded_at = COALESCE(refunded_at, ${refundedAt}::timestamptz)
     WHERE refund_id = ${refundId} AND refund_status <> 'succeeded'
     RETURNING id
  `)
  return res.rows.length > 0
}
