import 'server-only'

import type { Env } from '@/lib/env'
import { ConfigError } from '@/lib/errors'
import { logger as defaultLogger, type Logger } from '@/lib/monitoring/logger'
import { systemClock, type Clock } from '@/lib/time'

import {
  assertCheckoutSessionInput,
  buildSessionParams,
  checkoutIdempotencyKey,
  loggableSessionParams,
} from '../checkoutSession'
import { normalizeStripeEvent, STRIPE_EVENT_NAMES } from '../normalize'
import {
  InvalidSignatureError,
  PaymentEventShapeError,
  PaymentSessionNotFoundError,
  type BalanceTransaction,
  type CheckoutSessionHandle,
  type CreateCheckoutSessionInput,
  type ExpireResult,
  type PaymentEvent,
  type PaymentsAdapter,
  type RefundInput,
  type RefundResult,
  type SessionState,
} from '../types'

import { createStripeClient, Stripe, type StripeClientInput } from './client'
import {
  MAX_LIST_ITEMS,
  STRIPE_API_VERSION,
  UPDATE_SHIPPING_STRATEGY,
  WEBHOOK_TOLERANCE_SECONDS,
} from './config'

// Stripe-Treiber (ARCHITEKTUR §3.5). Das Paket `stripe` wird nur unter src/lib/payments/stripe/ importiert
// (check:static `stripe-import`); nach außen gehen nur eigene Typen. Session-Parameter kommen ausschließlich aus
// `buildSessionParams` (dieselben Regeln wie beim Mock), Ereignisse laufen durch `normalizeStripeEvent`.
// Protokolle ohne Personendaten, ohne Token und ohne Client-Secret (§8.11).

export function stripeMode(secretKey: string): 'test' | 'live' {
  return /^(sk|rk)_live_/.test(secretKey) ? 'live' : 'test'
}

/** Header der Webhook-Signatur. */
export const STRIPE_SIGNATURE_HEADER = 'stripe-signature'

/** Antwort von Stripe hat nicht die erwartete Form (z. B. Session ohne `client_secret`). */
export class StripeResponseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StripeResponseError'
  }
}

/** Stripe meldet einen anderen Modus als der Schlüssel (z. B. `livemode: true` mit Testschlüssel) – Treiber gestoppt. */
export class StripeLivemodeError extends ConfigError {
  constructor(expected: 'test' | 'live', livemode: boolean) {
    super(
      `Stripe meldet livemode=${String(livemode)}, erwartet ist ${expected === 'live' ? 'Live' : 'Test'}modus. ` +
        'Der Zahlungs-Treiber ist gestoppt (ARCHITEKTUR §3.5) – Schlüssel prüfen.',
    )
    this.name = 'StripeLivemodeError'
  }
}

export interface StripeAdapterOptions {
  clock?: Clock
  logger?: Logger
  /** Nur Tests: eigener HTTP-Client (`stripeFetchHttpClient`). */
  httpClient?: StripeClientInput['httpClient']
}

type StripeEnv = Partial<
  Pick<Env, 'STRIPE_SECRET_KEY' | 'STRIPE_WEBHOOK_SECRET' | 'STRIPE_API_BASE_URL'>
>

const SESSION_STATUSES = ['open', 'complete', 'expired'] as const
const PAYMENT_STATUSES = ['paid', 'unpaid', 'no_payment_required'] as const
const toSeconds = (d: Date) => Math.floor(d.getTime() / 1000)
const idOf = (v: string | { id: string } | null | undefined): string | undefined =>
  typeof v === 'string' ? v : (v?.id ?? undefined)

function isInvalidRequest(
  e: unknown,
): e is InstanceType<typeof Stripe.errors.StripeInvalidRequestError> {
  return e instanceof Stripe.errors.StripeInvalidRequestError
}
const isResourceMissing = (e: unknown) => isInvalidRequest(e) && e.code === 'resource_missing'

function refundStatus(status: string | null | undefined): RefundResult['status'] {
  if (status === 'succeeded') return 'succeeded'
  if (status === 'failed' || status === 'canceled') return 'failed'
  return 'pending'
}

/** Zahlart aus der letzten Belastung (nur card/paypal, R-062); Wallet nur bei Karte. */
function paymentMethodOf(pi: unknown): SessionState['paymentMethod'] {
  if (!pi || typeof pi !== 'object') return undefined
  const charge = (pi as { latest_charge?: unknown }).latest_charge
  if (!charge || typeof charge !== 'object') return undefined
  const details = (
    charge as {
      payment_method_details?: { type?: string; card?: { wallet?: { type?: string } | null } }
    }
  ).payment_method_details
  if (details?.type === 'paypal') return { type: 'paypal' }
  if (details?.type !== 'card') return undefined
  const wallet = details.card?.wallet?.type
  return wallet === 'apple_pay' || wallet === 'google_pay'
    ? { type: 'card', wallet }
    : { type: 'card' }
}

export function createStripeAdapter(
  env: StripeEnv,
  options: StripeAdapterOptions = {},
): PaymentsAdapter {
  const key = env.STRIPE_SECRET_KEY
  if (!key) {
    throw new ConfigError(
      'PAYMENTS_DRIVER=stripe, aber STRIPE_SECRET_KEY fehlt. Bitte einen Stripe-Testschlüssel (sk_test_…) setzen oder PAYMENTS_DRIVER=mock verwenden.',
    )
  }
  if (!/^(sk|rk)_(test|live)_/.test(key)) {
    throw new ConfigError(
      'STRIPE_SECRET_KEY muss mit sk_test_, rk_test_, sk_live_ oder rk_live_ beginnen.',
    )
  }
  const mode = stripeMode(key)
  if (mode === 'live' && env.STRIPE_API_BASE_URL) {
    throw new ConfigError(
      'STRIPE_API_BASE_URL (stripe-mock) ist mit einem Live-Schlüssel verboten.',
    )
  }
  const clock = options.clock ?? systemClock
  const log = options.logger ?? defaultLogger
  const stripe = createStripeClient({
    secretKey: key,
    baseUrl: env.STRIPE_API_BASE_URL,
    httpClient: options.httpClient,
  })

  // Modus-Wächter: Die erste Antwort mit abweichendem `livemode` stoppt den Treiber dauerhaft (§3.5).
  let stopped: StripeLivemodeError | undefined
  const ensureUsable = () => {
    if (stopped) throw stopped
  }
  const guard = <T>(o: T): T => {
    const livemode = (o as { livemode?: unknown } | null)?.livemode
    if (typeof livemode === 'boolean' && livemode !== (mode === 'live')) {
      stopped = new StripeLivemodeError(mode, livemode)
      log.error('payments.stripe.livemode_mismatch', { mode, livemode })
    }
    ensureUsable()
    return o
  }

  const retrieve = async (sessionId: string, expand?: string[]) => {
    try {
      return guard(
        await stripe.checkout.sessions.retrieve(sessionId, expand ? { expand } : undefined),
      )
    } catch (e) {
      if (isResourceMissing(e)) throw new PaymentSessionNotFoundError(sessionId)
      throw e
    }
  }

  const sessionStatus = (s: { id: string; status: string | null }) => {
    const status = SESSION_STATUSES.find((x) => x === s.status)
    if (!status)
      throw new StripeResponseError(`Session ${s.id}: unbekannter Status ${String(s.status)}.`)
    return status
  }

  const adapter: PaymentsAdapter = {
    driver: 'stripe',
    mode,

    async createCheckoutSession(i: CreateCheckoutSessionInput): Promise<CheckoutSessionHandle> {
      ensureUsable()
      assertCheckoutSessionInput(i, clock.now())
      const params = buildSessionParams(i)
      const idempotencyKey = checkoutIdempotencyKey(i.checkoutRef, i.sessionSeq)
      const session = guard(
        await stripe.checkout.sessions.create(
          params satisfies Stripe.Checkout.SessionCreateParams,
          { idempotencyKey },
        ),
      )
      if (!session.client_secret) {
        throw new StripeResponseError(
          `Session ${session.id} ohne client_secret (ui_mode elements erwartet).`,
        )
      }
      log.info('payments.stripe.session_created', {
        sessionId: session.id,
        idempotencyKey,
        params: loggableSessionParams(params),
      })
      return {
        sessionId: session.id,
        clientSecret: session.client_secret,
        expiresAt: new Date(session.expires_at * 1000),
      }
    },

    async updateShipping(sessionId, s) {
      ensureUsable()
      if (!Number.isInteger(s.amountCents) || s.amountCents < 0) {
        throw new Error('Versand muss ein Betrag in ganzen Cent ≥ 0 sein.')
      }
      if (!s.label.trim()) throw new Error('Versand: Anzeigename fehlt.')
      if (UPDATE_SHIPPING_STRATEGY === 'recreate') return 'recreate_required'
      try {
        const updated = guard(
          await stripe.checkout.sessions.update(sessionId, {
            shipping_options: [
              {
                shipping_rate_data: {
                  type: 'fixed_amount',
                  display_name: s.label,
                  fixed_amount: { amount: s.amountCents, currency: 'eur' },
                },
              },
            ],
          }),
        )
        return sessionStatus(updated) === 'open' ? 'updated' : 'recreate_required'
      } catch (e) {
        if (isResourceMissing(e)) throw new PaymentSessionNotFoundError(sessionId)
        // Spike B-07, Rückfallebene: Stripe lehnt die Änderung ab (Session nicht mehr offen oder für diese Session
        // nicht erlaubt) → alte Session beenden, neue mit derselben Reservierung (Aufrufer).
        if (isInvalidRequest(e)) {
          log.warn('payments.stripe.update_shipping_rejected', { sessionId, code: e.code ?? null })
          return 'recreate_required'
        }
        throw e
      }
    },

    async expireCheckoutSession(sessionId): Promise<ExpireResult> {
      ensureUsable()
      try {
        guard(await stripe.checkout.sessions.expire(sessionId))
        return 'expired'
      } catch (e) {
        if (isResourceMissing(e)) throw new PaymentSessionNotFoundError(sessionId)
        if (!isInvalidRequest(e)) throw e
        // Nicht (mehr) offen: Zustand abfragen. Alles Abgeschlossene außer `unpaid` gilt als bezahlt – nie freigeben.
        const s = await retrieve(sessionId)
        const status = sessionStatus(s)
        if (status === 'expired') return 'already_expired'
        if (status === 'complete') {
          return s.payment_status === 'unpaid' ? 'already_complete_unpaid' : 'already_complete_paid'
        }
        throw e
      }
    },

    async getCheckoutSession(sessionId): Promise<SessionState> {
      ensureUsable()
      const s = await retrieve(sessionId, ['payment_intent.latest_charge'])
      const status = sessionStatus(s)
      const paymentStatus = PAYMENT_STATUSES.find((x) => x === s.payment_status)
      if (!paymentStatus) {
        throw new StripeResponseError(
          `Session ${s.id}: unbekannter Zahlstatus ${s.payment_status}.`,
        )
      }
      const paymentIntentId = idOf(s.payment_intent)
      const paymentMethod = paymentMethodOf(s.payment_intent)
      return {
        sessionId: s.id,
        status,
        paymentStatus,
        ...(status === 'open' && s.client_secret ? { clientSecret: s.client_secret } : {}),
        ...(paymentIntentId ? { paymentIntentId } : {}),
        ...(typeof s.amount_total === 'number' ? { amountTotalCents: s.amount_total } : {}),
        ...(paymentMethod ? { paymentMethod } : {}),
      }
    },

    async refund(i: RefundInput): Promise<RefundResult> {
      ensureUsable()
      if (!Number.isInteger(i.amountCents) || i.amountCents <= 0) {
        throw new Error('Erstattungsbetrag muss eine positive Ganzzahl in Cent sein.')
      }
      if (!i.idempotencyKey) throw new Error('Erstattung braucht einen Idempotenz-Schlüssel.')
      const refund = guard(
        await stripe.refunds.create(
          {
            payment_intent: i.paymentIntentId,
            amount: i.amountCents,
            // Nur der eigene Grund-Code (z. B. `withdrawal`), keine Personendaten.
            metadata: { reason: i.reason.slice(0, 100) },
          },
          { idempotencyKey: i.idempotencyKey },
        ),
      )
      return { refundId: refund.id, status: refundStatus(refund.status) }
    },

    parseWebhook(rawBody, headers): PaymentEvent {
      const secret = env.STRIPE_WEBHOOK_SECRET
      if (!secret) {
        throw new ConfigError(
          'STRIPE_WEBHOOK_SECRET fehlt – Stripe-Webhooks können nicht geprüft werden.',
        )
      }
      const signature = headers.get(STRIPE_SIGNATURE_HEADER)
      if (!signature) throw new InvalidSignatureError()
      let event: unknown
      try {
        event = stripe.webhooks.constructEvent(
          rawBody,
          signature,
          secret,
          WEBHOOK_TOLERANCE_SECONDS,
          undefined,
          clock.now().getTime(),
        )
      } catch (e) {
        if (e instanceof Stripe.errors.StripeSignatureVerificationError) {
          throw new InvalidSignatureError()
        }
        if (e instanceof SyntaxError)
          throw new PaymentEventShapeError('Webhook-Körper ist kein JSON.')
        throw e
      }
      const apiVersion = (event as { api_version?: unknown }).api_version
      if (typeof apiVersion === 'string' && apiVersion !== STRIPE_API_VERSION) {
        log.warn('payments.stripe.webhook_api_version', {
          expected: STRIPE_API_VERSION,
          received: apiVersion,
        })
      }
      return normalizeStripeEvent(event, 'stripe')
    },

    async listEventsSince(since): Promise<PaymentEvent[]> {
      ensureUsable()
      const out: PaymentEvent[] = []
      const list = stripe.events.list({
        created: { gte: toSeconds(since) },
        types: [...STRIPE_EVENT_NAMES],
        limit: 100,
      })
      for await (const event of list) {
        guard(event)
        out.push(normalizeStripeEvent(event, 'stripe'))
        if (out.length >= MAX_LIST_ITEMS) break
      }
      // Stripe liefert die neuesten zuerst; der Abgleich verarbeitet in zeitlicher Reihenfolge.
      return out.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
      )
    },

    async listBalanceTransactions({ from, to }): Promise<BalanceTransaction[]> {
      ensureUsable()
      const txns: (BalanceTransaction & { created: number })[] = []
      for await (const t of stripe.balanceTransactions.list({
        created: { gte: toSeconds(from), lt: toSeconds(to) },
        limit: 100,
      })) {
        guard(t)
        if (t.type !== 'payout') {
          const sourceId = idOf(t.source) ?? ''
          txns.push({ id: t.id, sourceId, feeCents: t.fee, netCents: t.net, created: t.created })
        }
        if (txns.length >= MAX_LIST_ITEMS) break
      }
      // Wie beim Mock: älteste zuerst, bei Gleichstand nach ID (Monatsexport byte-gleich, KONZEPT §7.15).
      txns.sort((a, b) => a.created - b.created || a.id.localeCompare(b.id))
      // Auszahlung je Buchung: automatische Auszahlungen ab Zeitraumbeginn bis 60 Tage nach Zeitraumende, je Auszahlung
      // ihre Buchungen (`payout`-Filter); Datum = Eingang auf dem Konto (`arrival_date`).
      const payoutOf = new Map<string, { payoutId: string; payoutDate: Date }>()
      if (txns.length > 0) {
        for await (const p of stripe.payouts.list({
          created: { gte: toSeconds(from), lt: toSeconds(to) + 60 * 86_400 },
          limit: 100,
        })) {
          guard(p)
          if (!p.automatic) continue
          for await (const t of stripe.balanceTransactions.list({ payout: p.id, limit: 100 })) {
            payoutOf.set(t.id, { payoutId: p.id, payoutDate: new Date(p.arrival_date * 1000) })
          }
        }
      }
      return txns.map(({ created: _created, ...t }) => ({ ...t, ...payoutOf.get(t.id) }))
    },
  }
  return adapter
}
