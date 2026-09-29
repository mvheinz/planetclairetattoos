import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import { createLocalReq, type Payload } from 'payload'

import { dbFor, type SqlExecutor } from '@/lib/db/tx'
import { jobAlarm } from '@/lib/jobs/alarm'
import { createLogger } from '@/lib/monitoring/logger'
import { inTransaction } from '@/lib/payload/transaction'
import { getPaymentsAdapter, type PaymentsAdapter } from '@/lib/payments'

import { transitionCheckout } from './checkoutTransitions'
import { confirmedPaymentFromSession, fulfillCheckout } from './fulfillCheckout'
import { releaseReservation } from './reservation'

// Task `releaseExpiredReservations` (PLAN P4.18, DATENMODELL §11, KONZEPT §4.6/§4.10/§4.11 S3/S10): (a) abgelaufene
// Kassen-Reservierungen freigeben – vorher die Session beim Anbieter beenden, bei „bezahlt“ Bestellabschluss statt
// Freigabe; Vorkasse-Reservierungen nie; (b) Kassen, die seit > 10 min `confirming` sind, beim Anbieter abgleichen;
// (c) nächsten Weckzeitpunkt schreiben. Jede Aktion in eigener Transaktion, Uhr injiziert (A-08).

const log = createLogger()

/** Kasse `confirming` wird nach dieser Zeit beim Anbieter abgefragt (KONZEPT §4.10, ARCHITEKTUR §9.6 Nr. 4). */
export const CONFIRMING_RECONCILE_MS = 10 * 60 * 1000
/** Höchstens so viele Aktionen je Teil und Lauf (Rest beim nächsten Lauf). */
export const EXPIRY_BATCH = 100

export interface ExpiryDeps {
  payload: Payload
  payments?: PaymentsAdapter
  now: Date
}

export interface ExpiryResult {
  released: number
  fulfilled: number
  reopened: number
  waiting: number
  errors: number
  nextDueAt: Date | null
}

const sqlOf = (payload: Payload) => (payload.db as unknown as { drizzle: SqlExecutor }).drizzle

async function releaseExpired(deps: Required<ExpiryDeps>, out: ExpiryResult): Promise<void> {
  const { payload, payments, now } = deps
  const res = await sqlOf(payload).execute(sql`
    SELECT ref, min(expires_at) AS expires_at FROM reservations
     WHERE status = 'active' AND source = 'checkout_session' AND expires_at < ${now.toISOString()}::timestamptz
     GROUP BY ref ORDER BY min(expires_at) LIMIT ${EXPIRY_BATCH}
  `)
  for (const row of res.rows) {
    const ref = String(row.ref)
    try {
      const outcome = await releaseReservation(ref, 'session_expired', now, {
        payload,
        payments,
        releaseWhenUnpaid: true,
        source: 'checkout_session',
      })
      if (outcome.status === 'released') out.released += 1
      else if (outcome.status === 'paid') out.fulfilled += 1
      else out.waiting += 1
    } catch (err) {
      out.errors += 1
      log.error('jobs.release_failed', { ref, error: (err as Error)?.message })
    }
  }
}

async function reconcileConfirming(deps: Required<ExpiryDeps>, out: ExpiryResult): Promise<void> {
  const { payload, payments, now } = deps
  const before = new Date(now.getTime() - CONFIRMING_RECONCILE_MS).toISOString()
  const res = await sqlOf(payload).execute(sql`
    SELECT id, stripe_checkout_session_id AS session_id, reservation_ref FROM checkouts
     WHERE status = 'confirming' AND timestamps_confirming_at <= ${before}::timestamptz
       AND stripe_checkout_session_id IS NOT NULL
     ORDER BY timestamps_confirming_at LIMIT ${EXPIRY_BATCH}
  `)
  for (const row of res.rows) {
    const checkoutId = Number(row.id)
    const sessionId = String(row.session_id)
    try {
      const state = await payments.getCheckoutSession(sessionId)
      if (state.status === 'complete' && state.paymentStatus === 'paid') {
        // S10: Zahlung bestätigt, Webhook fehlt – Bestellabschluss (idempotent).
        const req = await createLocalReq(
          { context: { system: true, now: now.toISOString() } },
          payload,
        )
        const result = await fulfillCheckout(checkoutId, req, {
          now,
          payment: confirmedPaymentFromSession(state, {
            driver: payments.driver,
            livemode: payments.mode === 'live',
            paidAt: now,
          }),
        })
        await result.afterCommit()
        out.fulfilled += 1
        continue
      }
      if (state.status === 'open') {
        const req = await createLocalReq(
          { context: { system: true, now: now.toISOString() } },
          payload,
        )
        const reopened = await inTransaction(req, async () => {
          const valid = await (
            await dbFor(req)
          ).execute(sql`
            SELECT count(*)::int AS n FROM reservations
             WHERE ref = ${String(row.reservation_ref)} AND status = 'active'
               AND expires_at > ${now.toISOString()}::timestamptz
          `)
          if (Number(valid.rows[0]?.n ?? 0) === 0) return false
          await transitionCheckout(req, checkoutId, 'open', { now })
          return true
        })
        if (reopened) {
          out.reopened += 1
          continue
        }
      }
      // Sonst (verzögerte Zahlart, Session beendet) bis zum Ablauf der Reservierung warten.
      out.waiting += 1
    } catch (err) {
      out.errors += 1
      log.error('jobs.reconcile_failed', { checkoutId, error: (err as Error)?.message })
    }
  }
}

/** Nächster Weckzeitpunkt: früheste aktive Kassen-Reservierung bzw. Kasse `confirming` + 10 min (nach `now`). */
export async function nextReservationWake(payload: Payload, now: Date): Promise<Date | null> {
  const at = now.toISOString()
  const res = await sqlOf(payload).execute(sql`
    SELECT least(
      (SELECT min(expires_at) FROM reservations
        WHERE status = 'active' AND source = 'checkout_session' AND expires_at >= ${at}::timestamptz),
      (SELECT min(timestamps_confirming_at) + interval '10 minutes' FROM checkouts
        WHERE status = 'confirming'
          AND timestamps_confirming_at + interval '10 minutes' > ${at}::timestamptz)
    ) AS next
  `)
  const next = res.rows[0]?.next
  return next ? new Date(next as string | Date) : null
}

export async function releaseExpiredReservations(deps: ExpiryDeps): Promise<ExpiryResult> {
  const full: Required<ExpiryDeps> = { ...deps, payments: deps.payments ?? getPaymentsAdapter() }
  const out: ExpiryResult = {
    released: 0,
    fulfilled: 0,
    reopened: 0,
    waiting: 0,
    errors: 0,
    nextDueAt: null,
  }
  await releaseExpired(full, out)
  await reconcileConfirming(full, out)
  out.nextDueAt = await nextReservationWake(deps.payload, deps.now)
  if (out.nextDueAt) await jobAlarm.bump(out.nextDueAt)
  log.info('jobs.release_expired', { ...out, nextDueAt: out.nextDueAt?.toISOString() ?? null })
  return out
}
