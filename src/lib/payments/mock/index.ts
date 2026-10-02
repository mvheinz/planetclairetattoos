import 'server-only'

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

import { getEnv } from '@/lib/env'
import type { AppEnv } from '@/lib/env.schema'
import { logger as defaultLogger, type Logger } from '@/lib/monitoring/logger'
import { deriveKey } from '@/lib/security/keys'
import { systemClock, type Clock } from '@/lib/time'

import {
  assertCheckoutSessionInput,
  buildSessionParams,
  loggableSessionParams,
} from '../checkoutSession'
import { BALANCE_TRANSACTIONS_FIXTURE } from '../fixtures'
import { normalizeStripeEvent, type StripeEventType } from '../normalize'
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

import { buildMockEventBody, type MockEventContext } from './events'
import {
  emptyMockState,
  fromStoredEvent,
  MOCK_OUTCOMES,
  toStoredEvent,
  type MockDispute,
  type MockNextOutcome,
  type MockPaymentMethod,
  type MockRefund,
  type MockSession,
  type MockState,
} from './state'
import { createDbMockStore, type MockDbSource, type MockStore } from './store'

export type { MockNextOutcome, MockOutcome, MockPaymentMethod } from './state'

// Mock-Treiber (ARCHITEKTUR §3.5, KONZEPT §4.7): keine Netzwerk-Anfragen; IDs cs_mock_/pi_mock_/re_mock_/evt_mock_,
// Client-Secret mock_secret_ (abgeleitet, nie gespeichert); Zustand in `checkouts.mock.state` (DB); Ereignisse aus den
// Stripe-Fixtures mit ersetzten Werten und derselben Normalisierung wie beim Stripe-Treiber; Webhook-Signatur als
// HMAC-SHA256 mit dem HKDF-Schlüssel `pc:mock-webhook:v1` im Header `x-pc-mock-signature`. In Produktion verboten
// (createPaymentsAdapter, assertProductionEnv). Test-API (`emit`, `setNextOutcome`) nur bei APP_ENV development/test.

export const MOCK_SIGNATURE_HEADER = 'x-pc-mock-signature'
export const MOCK_TEST_API_ENVS: ReadonlySet<AppEnv> = new Set<AppEnv>(['development', 'test'])

export class MockTestApiDisabledError extends Error {
  constructor(appEnv: string) {
    super(`Test-API der Mock-Zahlung nur bei APP_ENV development oder test (ist ${appEnv}).`)
    this.name = 'MockTestApiDisabledError'
  }
}

/** Ereignis passt nicht zum Zustand der Session (z. B. `completed` für eine abgelaufene Session). */
export class MockTransitionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MockTransitionError'
  }
}

export class MockCheckoutNotFoundError extends Error {
  constructor() {
    super(
      'Mock-Zahlung: keine Kasse mit dieser checkoutRef (die Kasse entsteht vor der Session, DATENMODELL §8.1).',
    )
    this.name = 'MockCheckoutNotFoundError'
  }
}

/** UUID v4 aus 16 Bytes (für abgeleitete, stabile Mock-IDs). */
function uuidFromBytes(bytes: Buffer): string {
  const b = Buffer.from(bytes.subarray(0, 16))
  b[6] = (b[6]! & 0x0f) | 0x40
  b[8] = (b[8]! & 0x3f) | 0x80
  const h = b.toString('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

function derivedUuid(purpose: string, value: string, secret?: string): string {
  return uuidFromBytes(
    createHmac('sha256', deriveKey('mockWebhook', secret)).update(`${purpose}:${value}`).digest(),
  )
}

export const mockId = {
  session: () => `cs_mock_${randomUUID()}`,
  paymentIntent: () => `pi_mock_${randomUUID()}`,
  charge: () => `ch_mock_${randomUUID()}`,
  refund: () => `re_mock_${randomUUID()}`,
  dispute: () => `du_mock_${randomUUID()}`,
  event: () => `evt_mock_${randomUUID()}`,
}

/** HMAC-SHA256 (hex) des Rohkörpers mit dem HKDF-Schlüssel `pc:mock-webhook:v1` (ARCHITEKTUR §8.6). */
export function signMockWebhook(rawBody: string, secret?: string): string {
  return createHmac('sha256', deriveKey('mockWebhook', secret)).update(rawBody).digest('hex')
}

/** Client-Secret einer Mock-Session – abgeleitet aus der Session-ID, daher nie gespeichert. */
export function mockClientSecret(sessionId: string, secret?: string): string {
  return `mock_secret_${derivedUuid('client-secret', sessionId, secret)}`
}

export interface MockEmission {
  /** Normalisiertes Ereignis (wie `parseWebhook(rawBody, headers)`). */
  event: PaymentEvent
  /** Stripe-förmiger Körper für `POST /api/stripe/webhook`. */
  rawBody: string
  /** Enthält `x-pc-mock-signature`. */
  headers: Headers
}

export interface MockPaymentsTestApi {
  /** Ereignis `type` für die Session auslösen: Zustand fortschreiben, protokollieren, signierten Körper liefern. */
  emit(sessionId: string, type: StripeEventType): Promise<MockEmission>
  /** Nächstes Test-Ergebnis vorgeben (Zahlung, Zahlart, Erstattung, Anfechtung); wird beim Gebrauch verbraucht. */
  setNextOutcome(sessionId: string, next: MockNextOutcome): Promise<void>
  /**
   * Test-Ergebnis „Verzögert“ (KONZEPT §4.7, S10): Session `complete`/`unpaid` **ohne** Ereignis – weder im Protokoll
   * noch in `webhook-events`; die Kasse bleibt `confirming`, bis der Abgleich sie klärt.
   */
  completeUnpaidWithoutEvent(sessionId: string, method?: MockPaymentMethod): Promise<void>
}

export interface MockPaymentsAdapter extends PaymentsAdapter, MockPaymentsTestApi {
  readonly driver: 'mock'
  readonly mode: 'mock'
}

export function isMockPaymentsAdapter(a: PaymentsAdapter): a is MockPaymentsAdapter {
  return a.driver === 'mock' && typeof (a as Partial<MockPaymentsAdapter>).emit === 'function'
}

export interface MockPaymentsOptions {
  /** Postgres-Pool (Standard: der von Payload). */
  db?: MockDbSource
  store?: MockStore
  clock?: Clock
  /** Geheimnis für HKDF (Standard: PAYLOAD_SECRET). */
  secret?: string
  /** Standard: APP_ENV aus getEnv() (beim Aufruf). */
  appEnv?: AppEnv
  logger?: Logger
}

const sum = (xs: number[]) => xs.reduce((n, x) => n + x, 0)

function assertCents(value: number, what: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${what} muss eine positive Ganzzahl in Cent sein.`)
  }
}

function validateNextOutcome(next: MockNextOutcome): void {
  if (next.result !== undefined && !MOCK_OUTCOMES.includes(next.result)) {
    throw new Error(`Unbekanntes Test-Ergebnis ${String(next.result)}.`)
  }
  const pm = next.paymentMethod
  if (pm) {
    if (pm.type !== 'card' && pm.type !== 'paypal') throw new Error('Zahlart nur card oder paypal.')
    if (pm.wallet !== undefined) {
      if (pm.type !== 'card') throw new Error('Wallet-Kennung nur bei card.')
      if (pm.wallet !== 'apple_pay' && pm.wallet !== 'google_pay') {
        throw new Error('Wallet nur apple_pay oder google_pay.')
      }
    }
  }
  if (next.refund !== undefined && !['pending', 'succeeded', 'failed'].includes(next.refund)) {
    throw new Error('Erstattungsergebnis nur pending, succeeded oder failed.')
  }
  if (next.dispute !== undefined && next.dispute !== 'won' && next.dispute !== 'lost') {
    throw new Error('Anfechtungsausgang nur won oder lost.')
  }
}

export function createMockPaymentsAdapter(options: MockPaymentsOptions = {}): MockPaymentsAdapter {
  const store = options.store ?? createDbMockStore(options.db)
  const clock = options.clock ?? systemClock
  const log = options.logger ?? defaultLogger
  const secret = options.secret
  const appEnvOf = (): AppEnv => options.appEnv ?? getEnv().APP_ENV

  const requireTestApi = () => {
    const appEnv = appEnvOf()
    if (!MOCK_TEST_API_ENVS.has(appEnv)) throw new MockTestApiDisabledError(appEnv)
  }

  /** Ereignis erzeugen, normalisieren und im Zustand protokollieren. */
  const record = (
    state: MockState,
    type: StripeEventType,
    session: MockSession,
    extra: Partial<MockEventContext> = {},
  ) => {
    const body = buildMockEventBody(type, {
      eventId: mockId.event(),
      created: clock.now(),
      checkoutRef: state.checkoutRef,
      appEnv: state.appEnv,
      session,
      ...extra,
    })
    const event = normalizeStripeEvent(body, 'mock')
    state.events.push(toStoredEvent(event))
    return { body, event }
  }

  /** Offene Sessions laufen wie bei Stripe von selbst ab (mit Ereignis `checkout.session.expired`). */
  const expireIfDue = (state: MockState, session: MockSession): boolean => {
    if (session.status !== 'open') return false
    if (Date.parse(session.expiresAt) > clock.now().getTime()) return false
    session.status = 'expired'
    record(state, 'checkout.session.expired', session)
    return true
  }

  const withSession = <T>(
    sessionId: string,
    fn: (state: MockState, session: MockSession) => { changed: boolean; result: T },
  ): Promise<T> =>
    store.mutate({ by: 'sessionId', value: sessionId }, (row) => {
      const state = row?.state
      const session = state?.sessions.find((s) => s.sessionId === sessionId)
      if (!state || !session) throw new PaymentSessionNotFoundError(sessionId)
      const expired = expireIfDue(state, session)
      const { changed, result } = fn(state, session)
      return { next: changed || expired ? state : undefined, result }
    })

  const toState = (s: MockSession): SessionState => ({
    sessionId: s.sessionId,
    status: s.status,
    paymentStatus: s.paymentStatus,
    ...(s.status === 'open' ? { clientSecret: mockClientSecret(s.sessionId, secret) } : {}),
    ...(s.paymentIntentId ? { paymentIntentId: s.paymentIntentId } : {}),
    ...(s.chargeId ? { chargeId: s.chargeId } : {}),
    amountTotalCents: s.amountTotalCents,
    ...(s.paymentMethod ? { paymentMethod: s.paymentMethod } : {}),
  })

  const activeRefunds = (state: MockState, pi: string) =>
    state.refunds.filter((r) => r.paymentIntentId === pi && r.status !== 'failed')

  const newRefund = (
    state: MockState,
    session: MockSession,
    amountCents: number,
    status: MockRefund['status'],
    idempotencyKey: string,
    reason = 'requested_by_customer',
  ): MockRefund => {
    const refundId = mockId.refund()
    const refund: MockRefund = {
      refundId,
      idempotencyKey: idempotencyKey || `emit:${refundId}`,
      sessionId: session.sessionId,
      paymentIntentId: session.paymentIntentId!,
      chargeId: session.chargeId!,
      amountCents,
      status,
      reason,
      createdAt: clock.now().toISOString(),
    }
    state.refunds.push(refund)
    return refund
  }

  const requirePaid = (session: MockSession, type: string) => {
    if (session.status !== 'complete' || session.paymentStatus !== 'paid' || !session.chargeId) {
      throw new MockTransitionError(`${type}: die Session ist nicht bezahlt.`)
    }
  }

  const takeOutcome = <K extends keyof MockNextOutcome>(session: MockSession, key: K) => {
    const value = session.nextOutcome?.[key]
    if (session.nextOutcome) delete session.nextOutcome[key]
    return value
  }

  /** Zustandsübergang und Kontext eines ausgelösten Ereignisses (Test-API `emit`). */
  const applyEmit = (
    state: MockState,
    session: MockSession,
    type: StripeEventType,
  ): Partial<MockEventContext> => {
    const now = clock.now().toISOString()
    switch (type) {
      case 'checkout.session.completed': {
        if (session.status === 'complete') return {}
        if (session.status !== 'open') {
          throw new MockTransitionError(`${type}: die Session ist ${session.status}.`)
        }
        const result = session.nextOutcome?.result ?? 'success'
        if (result === 'declined' || result === 'cancelled') {
          throw new MockTransitionError(
            `${type}: nächstes Ergebnis ist „${result}“ – dann gibt es kein completed-Ereignis.`,
          )
        }
        takeOutcome(session, 'result')
        session.status = 'complete'
        session.paymentStatus = result === 'delayed' ? 'unpaid' : 'paid'
        session.paymentIntentId = mockId.paymentIntent()
        session.paymentMethod = takeOutcome(session, 'paymentMethod') ?? { type: 'card' }
        if (session.paymentStatus === 'paid') session.chargeId = mockId.charge()
        session.completedAt = now
        return {}
      }
      case 'checkout.session.async_payment_succeeded':
        if (session.status !== 'complete') {
          throw new MockTransitionError(`${type}: die Session ist ${session.status}.`)
        }
        if (session.paymentStatus !== 'paid') {
          session.paymentStatus = 'paid'
          session.chargeId = mockId.charge()
        }
        return {}
      case 'checkout.session.async_payment_failed':
        if (session.status !== 'complete' || session.paymentStatus !== 'unpaid') {
          throw new MockTransitionError(`${type}: nur für abgeschlossene, unbezahlte Sessions.`)
        }
        return {}
      case 'checkout.session.expired':
        if (session.status === 'complete') {
          throw new MockTransitionError(`${type}: die Session ist abgeschlossen.`)
        }
        session.status = 'expired'
        return {}
      case 'charge.refunded': {
        requirePaid(session, type)
        const pi = session.paymentIntentId!
        const before = sum(activeRefunds(state, pi).map((r) => r.amountCents))
        let refundedCents = before
        if (before === 0) {
          const refund = newRefund(state, session, session.amountTotalCents, 'succeeded', '')
          record(state, 'refund.created', session, { refund })
          refundedCents = refund.amountCents
        }
        return { refundedCents, previousRefundedCents: before }
      }
      case 'refund.created': {
        requirePaid(session, type)
        const open =
          session.amountTotalCents -
          sum(activeRefunds(state, session.paymentIntentId!).map((r) => r.amountCents))
        if (open <= 0) throw new MockTransitionError(`${type}: bereits vollständig erstattet.`)
        const status = takeOutcome(session, 'refund') ?? 'succeeded'
        return { refund: newRefund(state, session, open, status, '') }
      }
      case 'refund.updated':
      case 'refund.failed': {
        requirePaid(session, type)
        let refund = [...state.refunds].reverse().find((r) => r.sessionId === session.sessionId)
        if (!refund) {
          refund = newRefund(state, session, session.amountTotalCents, 'pending', '')
          record(state, 'refund.created', session, { refund })
        }
        const previousRefundStatus = refund.status
        if (type === 'refund.failed') refund.status = 'failed'
        else {
          const wanted = takeOutcome(session, 'refund')
          refund.status = wanted && wanted !== 'pending' ? wanted : 'succeeded'
        }
        return { refund, previousRefundStatus }
      }
      case 'charge.dispute.created': {
        requirePaid(session, type)
        const dispute: MockDispute = {
          disputeId: mockId.dispute(),
          sessionId: session.sessionId,
          chargeId: session.chargeId!,
          paymentIntentId: session.paymentIntentId!,
          amountCents: session.amountTotalCents,
          status: 'needs_response',
          createdAt: now,
        }
        state.disputes.push(dispute)
        return { dispute }
      }
      case 'charge.dispute.closed': {
        requirePaid(session, type)
        let dispute = [...state.disputes]
          .reverse()
          .find((d) => d.sessionId === session.sessionId && d.status === 'needs_response')
        if (!dispute) {
          dispute = applyEmit(state, session, 'charge.dispute.created').dispute!
          record(state, 'charge.dispute.created', session, { dispute })
        }
        const previousDisputeStatus = dispute.status
        dispute.status = takeOutcome(session, 'dispute') ?? 'lost'
        return { dispute, previousDisputeStatus }
      }
    }
  }

  const adapter: MockPaymentsAdapter = {
    driver: 'mock',
    mode: 'mock',

    async createCheckoutSession(i: CreateCheckoutSessionInput): Promise<CheckoutSessionHandle> {
      const now = clock.now()
      assertCheckoutSessionInput(i, now)
      const params = buildSessionParams(i)
      const subtotal = sum(i.lineItems.map((l) => l.amountCents))
      const session: MockSession = {
        sessionId: mockId.session(),
        status: 'open',
        paymentStatus: 'unpaid',
        locale: i.locale,
        amountSubtotalCents: subtotal,
        shippingCents: i.shipping.amountCents,
        shippingLabel: i.shipping.label,
        amountTotalCents: subtotal + i.shipping.amountCents,
        createdAt: now.toISOString(),
        expiresAt: i.expiresAt.toISOString(),
      }
      await store.mutate({ by: 'checkoutRef', value: i.checkoutRef }, (row) => {
        if (!row) throw new MockCheckoutNotFoundError()
        const state = row.state ?? emptyMockState(i.checkoutRef, i.metadata.appEnv)
        state.appEnv = i.metadata.appEnv
        state.sessions.push(session)
        return { next: state, result: undefined }
      })
      log.info('payments.mock.session_created', {
        sessionId: session.sessionId,
        params: loggableSessionParams(params),
      })
      return {
        sessionId: session.sessionId,
        clientSecret: mockClientSecret(session.sessionId, secret),
        expiresAt: i.expiresAt,
      }
    },

    async updateShipping(sessionId, s) {
      if (!Number.isInteger(s.amountCents) || s.amountCents < 0) {
        throw new Error('Versand muss ein Betrag in ganzen Cent ≥ 0 sein.')
      }
      return withSession(sessionId, (_state, session) => {
        if (session.status !== 'open')
          return { changed: false, result: 'recreate_required' as const }
        session.shippingCents = s.amountCents
        session.shippingLabel = s.label
        session.amountTotalCents = session.amountSubtotalCents + s.amountCents
        return { changed: true, result: 'updated' as const }
      })
    },

    async expireCheckoutSession(sessionId): Promise<ExpireResult> {
      return withSession(sessionId, (state, session) => {
        if (session.status === 'expired')
          return { changed: false, result: 'already_expired' as const }
        if (session.status === 'complete') {
          return {
            changed: false,
            result:
              session.paymentStatus === 'paid'
                ? ('already_complete_paid' as const)
                : ('already_complete_unpaid' as const),
          }
        }
        session.status = 'expired'
        record(state, 'checkout.session.expired', session)
        return { changed: true, result: 'expired' as const }
      })
    },

    async getCheckoutSession(sessionId) {
      return withSession(sessionId, (_state, session) => ({
        changed: false,
        result: toState(session),
      }))
    },

    async refund(i: RefundInput): Promise<RefundResult> {
      assertCents(i.amountCents, 'Erstattungsbetrag')
      if (!i.idempotencyKey) throw new Error('Erstattung braucht einen Idempotenz-Schlüssel.')
      return store.mutate({ by: 'paymentIntentId', value: i.paymentIntentId }, (row) => {
        const state = row?.state
        const session = state?.sessions.find((s) => s.paymentIntentId === i.paymentIntentId)
        if (!state || !session) {
          // Zahlung ohne Mock-Kasse (z. B. Beispiel-Bestellung): stabile ID je Schlüssel, Ergebnis „erstattet“.
          return {
            result: {
              refundId: `re_mock_${derivedUuid('refund', i.idempotencyKey, secret)}`,
              status: 'succeeded' as const,
            },
          }
        }
        const existing = state.refunds.find((r) => r.idempotencyKey === i.idempotencyKey)
        if (existing) return { result: { refundId: existing.refundId, status: existing.status } }
        requirePaid(session, 'refund')
        const refunded = sum(activeRefunds(state, i.paymentIntentId).map((r) => r.amountCents))
        if (refunded + i.amountCents > session.amountTotalCents) {
          throw new Error('Erstattungsbetrag übersteigt den noch nicht erstatteten Betrag.')
        }
        const status = takeOutcome(session, 'refund') ?? 'succeeded'
        const refund = newRefund(state, session, i.amountCents, status, i.idempotencyKey, i.reason)
        record(state, 'refund.created', session, { refund })
        if (status === 'failed') {
          record(state, 'refund.failed', session, { refund, previousRefundStatus: 'pending' })
        } else {
          record(state, 'charge.refunded', session, {
            refundedCents: refunded + i.amountCents,
            previousRefundedCents: refunded,
          })
        }
        return { next: state, result: { refundId: refund.refundId, status } }
      })
    },

    parseWebhook(rawBody, headers) {
      const given = headers.get(MOCK_SIGNATURE_HEADER) ?? ''
      const expected = signMockWebhook(rawBody, secret)
      const a = Buffer.from(given, 'utf8')
      const b = Buffer.from(expected, 'utf8')
      if (a.length !== b.length || !timingSafeEqual(a, b)) throw new InvalidSignatureError()
      let body: unknown
      try {
        body = JSON.parse(rawBody)
      } catch {
        throw new PaymentEventShapeError('Webhook-Körper ist kein JSON.')
      }
      return normalizeStripeEvent(body, 'mock')
    },

    async listEventsSince(since) {
      return (await store.eventsSince(since)).map(fromStoredEvent)
    },

    async listBalanceTransactions({ from, to }): Promise<BalanceTransaction[]> {
      const payouts = BALANCE_TRANSACTIONS_FIXTURE.filter((t) => t.type === 'payout').sort(
        (a, b) => a.created - b.created,
      )
      return BALANCE_TRANSACTIONS_FIXTURE.filter(
        (t) =>
          t.type !== 'payout' &&
          t.created * 1000 >= from.getTime() &&
          t.created * 1000 < to.getTime(),
      )
        .sort((a, b) => a.created - b.created || a.id.localeCompare(b.id))
        .map((t) => {
          const payout = payouts.find((p) => p.created >= t.available_on)
          return {
            id: t.id,
            sourceId: t.source,
            feeCents: t.fee,
            netCents: t.net,
            ...(payout
              ? { payoutId: payout.source, payoutDate: new Date(payout.created * 1000) }
              : {}),
          }
        })
    },

    async emit(sessionId, type) {
      requireTestApi()
      const { body, event } = await withSession(sessionId, (state, session) => {
        const extra = applyEmit(state, session, type)
        return { changed: true, result: record(state, type, session, extra) }
      })
      const rawBody = JSON.stringify(body)
      return {
        event,
        rawBody,
        headers: new Headers({
          'content-type': 'application/json',
          [MOCK_SIGNATURE_HEADER]: signMockWebhook(rawBody, secret),
        }),
      }
    },

    async completeUnpaidWithoutEvent(sessionId, method) {
      requireTestApi()
      if (method) validateNextOutcome({ paymentMethod: method })
      await withSession(sessionId, (_state, session) => {
        if (session.status !== 'open') {
          throw new MockTransitionError(`Verzögert: die Session ist ${session.status}.`)
        }
        session.status = 'complete'
        session.paymentStatus = 'unpaid'
        session.paymentIntentId = mockId.paymentIntent()
        session.paymentMethod = method ?? takeOutcome(session, 'paymentMethod') ?? { type: 'card' }
        session.completedAt = clock.now().toISOString()
        return { changed: true, result: undefined }
      })
    },

    async setNextOutcome(sessionId, next) {
      requireTestApi()
      validateNextOutcome(next)
      await withSession(sessionId, (_state, session) => {
        session.nextOutcome = { ...session.nextOutcome, ...next }
        return { changed: true, result: undefined }
      })
    },
  }
  return adapter
}
