import 'server-only'

import { createHash } from 'node:crypto'

import config from '@payload-config'
import { sql } from '@payloadcms/db-postgres'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'

import { revalidateProduct } from '@/lib/cache/revalidate'
import { releaseInTransaction } from '@/lib/commerce/reservation'
import { dbFor, type SqlExecutor } from '@/lib/db/tx'
import { sendAdminAlert } from '@/lib/email/alerts'
import { getEnv } from '@/lib/env'
import type { CheckoutStatus } from '@/lib/enums'
import { createLogger } from '@/lib/monitoring/logger'
import { inTransaction } from '@/lib/payload/transaction'
import { systemClock } from '@/lib/time'

import { getPaymentsAdapter } from './index'
import { paymentEventData, type CheckoutEventData } from './normalize'
import {
  NotImplementedYetError,
  type PaymentEvent,
  type PaymentEventType,
  type PaymentsAdapter,
} from './types'

// Ereignisverarbeitung der Zahlungs-Webhooks (DATENMODELL §8.8, KONZEPT §4.10, ARCHITEKTUR §3.5) – dieselbe Funktion
// für den Stripe-Webhook, den Mock und den Abgleich (`pnpm payments:reconcile`):
// (1) Ereignis in `webhook_events` beanspruchen (INSERT … ON CONFLICT; bereits verarbeitet oder in Arbeit ⇒ nichts tun);
// (2) Verarbeitung in einer Transaktion mit zustandsbasierten Prüfungen, am Ende `processed` bzw. `ignored` in derselben
//     Transaktion; (3) Fehler ⇒ Rollback, `failed` + `lastError` (Aufrufer antwortet 500, Stripe wiederholt), ab dem
//     2. Fehlversuch A12. Bestand und Bestellung ändern sich nur hier bzw. in Jobs, nie über die Rückkehr-URL.

const log = createLogger()

/** Eine Zeile in `processing`, die so lange nicht fertig wurde, gilt als abgebrochen (Neustart) und darf neu laufen. */
export const STALE_PROCESSING_MS = 10 * 60 * 1000

export type ProcessStatus = 'processed' | 'ignored' | 'duplicate'

export interface ProcessResult {
  status: ProcessStatus
  /** Was die Verarbeitung getan hat (für Logs und Tests), z. B. `fulfilled`, `released`, `logged_unpaid`. */
  action?: string
  webhookEventId?: number
  checkoutId?: number | null
  orderId?: number | null
}

export interface ProcessDeps {
  payload?: Payload
  /** Adapter für Rückfragen beim Anbieter (Zahlart, Belastung); Standard: aktiver Treiber. */
  payments?: PaymentsAdapter
  /** Injizierte Zeit (A-08); Standard: Systemuhr. */
  now?: Date
  /** SHA-256 des Rohkörpers (Webhook); ohne Rohkörper (Mock, Abgleich) aus dem normalisierten Ereignis. */
  payloadSha256?: string
}

/** Ergebnis eines Handlers: Status der Zeile, Bezüge und Arbeiten nach dem Commit (Belege, Mails, Cache). */
export interface HandlerOutcome {
  status: 'processed' | 'ignored'
  action: string
  checkoutId?: number | null
  orderId?: number | null
  afterCommit?: () => Promise<void>
}

export interface CheckoutRow {
  id: number
  status: CheckoutStatus
  reservationRef: string
  sessionId: string | null
  orderId: number | null
}

export interface PaidCheckoutHandler {
  (
    req: PayloadRequest,
    event: PaymentEvent,
    data: CheckoutEventData,
    checkout: CheckoutRow,
    deps: Required<Pick<ProcessDeps, 'payments'>> & { now: Date },
  ): Promise<HandlerOutcome>
}

/** Bezahlte Session → Bestellabschluss; verdrahtet P4.16a (`fulfillCheckout`). */
let paidHandler: PaidCheckoutHandler = async () => {
  throw new NotImplementedYetError('Bestellabschluss (fulfillCheckout)', 'P4.16a')
}

export function getPaidCheckoutHandler(): PaidCheckoutHandler {
  return paidHandler
}

/** Registriert den Handler für bezahlte Sessions (P4.16a). */
export function setPaidCheckoutHandler(handler: PaidCheckoutHandler): void {
  paidHandler = handler
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

function sqlOf(payload: Payload): SqlExecutor {
  return (payload.db as unknown as { drizzle: SqlExecutor }).drizzle
}

/** Schritt 2 aus §8.8: beanspruchen. `null` ⇒ bereits verarbeitet oder gerade in Arbeit. */
async function claim(
  payload: Payload,
  event: PaymentEvent,
  providerType: string,
  payloadSha256: string,
  now: Date,
): Promise<{ id: number; attempts: number } | null> {
  const at = now.toISOString()
  const stale = new Date(now.getTime() - STALE_PROCESSING_MS).toISOString()
  const res = await sqlOf(payload).execute(sql`
    INSERT INTO webhook_events (provider, event_id, type, livemode, status, attempts, received_at, payload_sha256,
                                created_at, updated_at)
    VALUES (${event.provider}::enum_webhook_events_provider, ${event.id}, ${providerType.slice(0, 100)},
            ${event.livemode}, 'processing', 1, ${at}::timestamptz, ${payloadSha256}, ${at}::timestamptz,
            ${at}::timestamptz)
    ON CONFLICT (event_id) DO UPDATE
       SET status = 'processing', attempts = webhook_events.attempts + 1, updated_at = ${at}::timestamptz
     WHERE webhook_events.status = 'failed'
        OR (webhook_events.status = 'processing' AND webhook_events.updated_at < ${stale}::timestamptz)
    RETURNING id, attempts
  `)
  const row = res.rows[0]
  return row ? { id: Number(row.id), attempts: Number(row.attempts) } : null
}

async function finish(
  db: SqlExecutor,
  id: number,
  outcome: Pick<HandlerOutcome, 'status' | 'checkoutId' | 'orderId'>,
  now: Date,
): Promise<void> {
  const at = now.toISOString()
  await db.execute(sql`
    UPDATE webhook_events
       SET status = ${outcome.status}::enum_webhook_events_status, processed_at = ${at}::timestamptz,
           last_error = NULL, related_checkout_id = ${outcome.checkoutId ?? null},
           related_order_id = ${outcome.orderId ?? null}, updated_at = ${at}::timestamptz
     WHERE id = ${id}
  `)
}

/** Kasse zur Session: über `client_reference_id` (= `reservationRef`), sonst über `stripe.checkoutSessionId`. */
export async function findCheckoutForSession(
  db: SqlExecutor,
  data: Pick<CheckoutEventData, 'checkoutRef' | 'sessionId'>,
  lock = false,
): Promise<CheckoutRow | null> {
  const where = data.checkoutRef
    ? sql`reservation_ref = ${data.checkoutRef}`
    : sql`stripe_checkout_session_id = ${data.sessionId}`
  const res = await db.execute(sql`
    SELECT id, status, reservation_ref, stripe_checkout_session_id, order_id FROM checkouts
     WHERE ${where} LIMIT 1 ${lock ? sql`FOR UPDATE` : sql``}
  `)
  const r = res.rows[0]
  if (!r) return null
  return {
    id: Number(r.id),
    status: r.status as CheckoutStatus,
    reservationRef: String(r.reservation_ref),
    sessionId: (r.stripe_checkout_session_id as string | null) ?? null,
    orderId: r.order_id === null || r.order_id === undefined ? null : Number(r.order_id),
  }
}

const LIVE: ReadonlySet<CheckoutStatus> = new Set(['open', 'confirming'])

const CHECKOUT_TYPES: ReadonlySet<PaymentEventType> = new Set([
  'checkout.completed',
  'checkout.async_succeeded',
  'checkout.async_failed',
  'checkout.expired',
])

/** Freigabe der Kassen-Reservierungen dieser Session (§8.2, nur `source = checkout_session`) samt Kassenwechsel. */
async function releaseForSession(
  req: PayloadRequest,
  checkout: CheckoutRow,
  reason: 'session_expired' | 'payment_failed',
  now: Date,
): Promise<HandlerOutcome> {
  const productIds = await releaseInTransaction(req, {
    ref: checkout.reservationRef,
    reason,
    checkoutId: checkout.id,
    now,
    source: 'checkout_session',
  })
  return {
    status: 'processed',
    action: reason === 'payment_failed' ? 'failed_released' : 'expired_released',
    checkoutId: checkout.id,
    afterCommit: async () => {
      for (const id of productIds) revalidateProduct(id, { immediate: true })
    },
  }
}

async function handleCheckoutEvent(
  req: PayloadRequest,
  event: PaymentEvent,
  deps: { payments: PaymentsAdapter; now: Date },
): Promise<HandlerOutcome> {
  const data = paymentEventData(event as PaymentEvent & { type: 'checkout.completed' })
  const db = await dbFor(req)
  const checkout = await findCheckoutForSession(db, data, true)
  const appEnv = getEnv().APP_ENV
  if (!checkout) {
    if (data.appEnv && data.appEnv !== appEnv) {
      return { status: 'ignored', action: 'foreign_app_env' }
    }
    if (data.paymentStatus === 'paid' && event.type !== 'checkout.expired') {
      await sendAdminAlert(req, {
        kind: 'payment_unmatched',
        summary: 'Zahlung ohne passende Kasse',
        affected: `Stripe-Session ${data.sessionId}, Betrag ${data.amountTotalCents ?? '?'} Cent`,
        automatic: 'Es wurde keine Bestellung angelegt.',
        todo: 'Bitte im Stripe-Dashboard prüfen und die Zahlung erstatten.',
        now: deps.now,
      })
    }
    return { status: 'processed', action: 'no_checkout' }
  }
  // Ereignisse einer älteren Session derselben Kasse (Neuanlage mit `sessionSeq + 1`) geben nichts frei.
  const sameSession = checkout.sessionId === data.sessionId

  switch (event.type) {
    case 'checkout.completed':
      if (data.paymentStatus !== 'paid') {
        // Verzögerte Zahlart: nur protokollieren – Ergebnis folgt mit async_succeeded/async_failed.
        log.info('payments.checkout_completed_unpaid', { checkoutId: checkout.id })
        return { status: 'processed', action: 'logged_unpaid', checkoutId: checkout.id }
      }
      return paidHandler(req, event, data, checkout, deps)
    case 'checkout.async_succeeded':
      return paidHandler(req, event, data, checkout, deps)
    case 'checkout.async_failed':
      if (checkout.status !== 'confirming' || !sameSession) {
        return { status: 'processed', action: 'failed_ignored', checkoutId: checkout.id }
      }
      return releaseForSession(req, checkout, 'payment_failed', deps.now)
    case 'checkout.expired':
      if (!LIVE.has(checkout.status) || !sameSession) {
        // z. B. Kasse per Vorkasse abgeschlossen (`completed`) – ignorieren (KONZEPT §4.10).
        return { status: 'processed', action: 'expired_ignored', checkoutId: checkout.id }
      }
      return releaseForSession(req, checkout, 'session_expired', deps.now)
    default:
      return { status: 'ignored', action: 'unhandled', checkoutId: checkout.id }
  }
}

/**
 * Verarbeitet ein normalisiertes Zahlungs-Ereignis genau einmal (DATENMODELL §8.8). Wirft bei einem Fehler (die Zeile
 * steht dann auf `failed`); der Webhook antwortet darauf mit 500.
 */
export async function processPaymentEvent(
  event: PaymentEvent,
  deps: ProcessDeps = {},
): Promise<ProcessResult> {
  const payload = deps.payload ?? (await getPayload({ config }))
  const now = deps.now ?? systemClock.now()
  const payments = deps.payments ?? getPaymentsAdapter()
  const providerType = String((event.data as { providerType?: unknown }).providerType ?? event.type)
  const hash = deps.payloadSha256 ?? sha256(JSON.stringify({ id: event.id, type: providerType }))
  const claimed = await claim(payload, event, providerType, hash, now)
  if (!claimed) return { status: 'duplicate' }

  const req = await createLocalReq({ context: { system: true, now: now.toISOString() } }, payload)
  let outcome: HandlerOutcome
  try {
    outcome = await inTransaction(req, async () => {
      const result: HandlerOutcome = CHECKOUT_TYPES.has(event.type)
        ? await handleCheckoutEvent(req, event, { payments, now })
        : // Erstattungen und Anfechtungen folgen in P4.22; alle anderen Typen werden nicht behandelt.
          { status: 'ignored', action: event.type === 'ignored' ? 'unhandled_type' : 'later' }
      await finish(await dbFor(req), claimed.id, result, now)
      return result
    })
  } catch (err) {
    const message = `${(err as Error)?.name ?? 'Error'}: ${(err as Error)?.message ?? String(err)}`
    await sqlOf(payload).execute(sql`
      UPDATE webhook_events
         SET status = 'failed', last_error = ${message.slice(0, 1000)}, updated_at = ${now.toISOString()}::timestamptz
       WHERE id = ${claimed.id}
    `)
    log.error('payments.webhook_failed', {
      eventId: event.id,
      type: providerType,
      attempts: claimed.attempts,
      error: message,
    })
    if (claimed.attempts >= 2) {
      const alertReq = await createLocalReq({ context: { system: true } }, payload)
      await sendAdminAlert(alertReq, {
        kind: 'payment_webhook',
        summary: 'Zahlungs-Ereignis konnte nicht verarbeitet werden',
        affected: `Ereignis ${event.id} (${providerType}), ${claimed.attempts}. Versuch`,
        automatic: 'Stripe stellt das Ereignis erneut zu; bis dahin ist nichts verändert.',
        todo: 'Bleibt der Fehler, bitte die technische Betreuung informieren.',
        adminPath: '/collections/webhook-events',
        now,
      }).catch((e: unknown) =>
        log.error('payments.webhook_alert_failed', { error: (e as Error)?.message }),
      )
    }
    throw err
  }

  if (outcome.afterCommit) {
    try {
      await outcome.afterCommit()
    } catch (err) {
      // Belege und Mails holt der Job-Wecker nach; die Verarbeitung selbst ist abgeschlossen.
      log.error('payments.after_commit_failed', {
        eventId: event.id,
        error: (err as Error)?.message,
      })
    }
  }
  log.info('payments.event_processed', {
    eventId: event.id,
    type: providerType,
    status: outcome.status,
    action: outcome.action,
    checkoutId: outcome.checkoutId ?? null,
    orderId: outcome.orderId ?? null,
  })
  return {
    status: outcome.status,
    action: outcome.action,
    webhookEventId: claimed.id,
    checkoutId: outcome.checkoutId ?? null,
    orderId: outcome.orderId ?? null,
  }
}
