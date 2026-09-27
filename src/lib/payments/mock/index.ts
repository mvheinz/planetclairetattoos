import 'server-only'

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

import { deriveKey } from '@/lib/security/keys'
import { systemClock, type Clock } from '@/lib/time'

import {
  InvalidSignatureError,
  PAYMENT_EVENT_TYPES,
  PaymentSessionNotFoundError,
  type BalanceTransaction,
  type CheckoutSessionHandle,
  type CreateCheckoutSessionInput,
  type ExpireResult,
  type PaymentEvent,
  type PaymentEventType,
  type PaymentsAdapter,
  type RefundInput,
  type RefundResult,
  type SessionState,
} from '../types'

import { createMemoryMockStore, type MockPaymentsStore, type MockSessionRecord } from './store'

// Mock-Treiber (ARCHITEKTUR §3.5, KONZEPT §4.7): keine Netzwerk-Anfragen, IDs cs_mock_/pi_mock_/re_mock_/evt_mock_,
// clientSecret mock_secret_. In Produktion verboten (getPaymentsAdapter). Grundfassung P1.10; Fixtures, Test-Oberfläche
// und DB-Zustand folgen in P4.4.

export const MOCK_SIGNATURE_HEADER = 'x-pc-mock-signature'
const MIN_SESSION_MINUTES = 30

export const mockId = {
  session: () => `cs_mock_${randomUUID()}`,
  paymentIntent: () => `pi_mock_${randomUUID()}`,
  refund: () => `re_mock_${randomUUID()}`,
  event: () => `evt_mock_${randomUUID()}`,
  clientSecret: () => `mock_secret_${randomUUID()}`,
}

/** HMAC-SHA256 des Rohkörpers mit dem HKDF-Schlüssel `pc:mock-webhook:v1` (ARCHITEKTUR §8.6). */
export function signMockWebhook(rawBody: string, secret?: string): string {
  return createHmac('sha256', deriveKey('mockWebhook', secret)).update(rawBody).digest('hex')
}

export interface MockPaymentsAdapter extends PaymentsAdapter {
  /** Test-API (nur development/test): Ereignis für eine Session auslösen und den Zustand fortschreiben. */
  emit(sessionId: string, type: 'checkout.completed' | 'checkout.expired'): Promise<PaymentEvent>
}

export function createMockPaymentsAdapter(
  options: { store?: MockPaymentsStore; clock?: Clock; secret?: string } = {},
): MockPaymentsAdapter {
  const store = options.store ?? createMemoryMockStore()
  const clock = options.clock ?? systemClock

  const load = async (sessionId: string): Promise<MockSessionRecord> => {
    const r = await store.getSession(sessionId)
    if (!r) throw new PaymentSessionNotFoundError(sessionId)
    // Abgelaufene offene Sessions gelten als abgelaufen (wie bei Stripe).
    if (r.status === 'open' && Date.parse(r.expiresAt) <= clock.now().getTime()) {
      r.status = 'expired'
      await store.putSession(r)
    }
    return r
  }

  const toState = (r: MockSessionRecord): SessionState => ({
    sessionId: r.sessionId,
    status: r.status,
    paymentStatus: r.paymentStatus,
    ...(r.status === 'open' ? { clientSecret: r.clientSecret } : {}),
    ...(r.paymentIntentId ? { paymentIntentId: r.paymentIntentId } : {}),
    amountTotalCents: r.amountTotalCents,
    ...(r.paymentMethod ? { paymentMethod: r.paymentMethod } : {}),
  })

  const adapter: MockPaymentsAdapter = {
    driver: 'mock',
    mode: 'mock',

    async createCheckoutSession(i: CreateCheckoutSessionInput): Promise<CheckoutSessionHandle> {
      const now = clock.now()
      if (i.expiresAt.getTime() < now.getTime() + MIN_SESSION_MINUTES * 60_000) {
        throw new Error('expiresAt muss mindestens 30 Minuten in der Zukunft liegen.')
      }
      if (i.metadata.checkoutRef !== i.checkoutRef) {
        throw new Error('metadata.checkoutRef muss checkoutRef entsprechen.')
      }
      if (i.lineItems.length === 0) throw new Error('Mindestens eine Position nötig.')
      const amount = i.lineItems.reduce((sum, l) => sum + l.amountCents, 0) + i.shipping.amountCents
      const record: MockSessionRecord = {
        sessionId: mockId.session(),
        status: 'open',
        paymentStatus: 'unpaid',
        clientSecret: mockId.clientSecret(),
        amountTotalCents: amount,
        checkoutRef: i.checkoutRef,
        expiresAt: i.expiresAt.toISOString(),
        createdAt: now.toISOString(),
        shippingLabel: i.shipping.label,
        shippingCents: i.shipping.amountCents,
      }
      await store.putSession(record)
      return {
        sessionId: record.sessionId,
        clientSecret: record.clientSecret,
        expiresAt: i.expiresAt,
      }
    },

    async updateShipping(sessionId, s) {
      const r = await load(sessionId)
      if (r.status !== 'open') return 'recreate_required'
      const itemsCents = (r.amountTotalCents ?? 0) - r.shippingCents
      r.shippingCents = s.amountCents
      r.shippingLabel = s.label
      r.amountTotalCents = itemsCents + s.amountCents
      await store.putSession(r)
      return 'updated'
    },

    async expireCheckoutSession(sessionId): Promise<ExpireResult> {
      const r = await load(sessionId)
      if (r.status === 'expired') return 'already_expired'
      if (r.status === 'complete') {
        return r.paymentStatus === 'paid' ? 'already_complete_paid' : 'already_complete_unpaid'
      }
      r.status = 'expired'
      await store.putSession(r)
      return 'expired'
    },

    async getCheckoutSession(sessionId) {
      return toState(await load(sessionId))
    },

    async refund(i: RefundInput): Promise<RefundResult> {
      if (!Number.isInteger(i.amountCents) || i.amountCents <= 0) {
        throw new Error('Erstattungsbetrag muss eine positive Ganzzahl in Cent sein.')
      }
      const existing = await store.getRefund(i.idempotencyKey)
      if (existing) return existing
      const refund: RefundResult = { refundId: mockId.refund(), status: 'succeeded' }
      await store.putRefund(i.idempotencyKey, refund)
      return refund
    },

    parseWebhook(rawBody, headers) {
      const given = headers.get(MOCK_SIGNATURE_HEADER) ?? ''
      const expected = signMockWebhook(rawBody, options.secret)
      const a = Buffer.from(given, 'utf8')
      const b = Buffer.from(expected, 'utf8')
      if (a.length !== b.length || !timingSafeEqual(a, b)) throw new InvalidSignatureError()
      let body: { id?: unknown; type?: unknown; created?: unknown; data?: unknown }
      try {
        body = JSON.parse(rawBody) as typeof body
      } catch {
        throw new InvalidSignatureError('Webhook-Körper ist kein JSON.')
      }
      const type = (PAYMENT_EVENT_TYPES as readonly string[]).includes(String(body.type))
        ? (body.type as PaymentEventType)
        : 'ignored'
      return {
        id: String(body.id ?? ''),
        provider: 'mock',
        livemode: false,
        createdAt: new Date(String(body.created ?? clock.now().toISOString())),
        type,
        data: (body.data ?? {}) as Record<string, unknown>,
      }
    },

    async listEventsSince(since) {
      return store.eventsSince(since)
    },

    async listBalanceTransactions(): Promise<BalanceTransaction[]> {
      // Gebühren aus Fixtures folgen in P4.4; der Mock kennt keine Auszahlungen.
      return []
    },

    async emit(sessionId, type) {
      const r = await load(sessionId)
      if (type === 'checkout.completed') {
        r.status = 'complete'
        r.paymentStatus = 'paid'
        r.paymentIntentId = r.paymentIntentId ?? mockId.paymentIntent()
        r.paymentMethod = { type: 'card' }
      } else {
        r.status = 'expired'
      }
      await store.putSession(r)
      const event: PaymentEvent = {
        id: mockId.event(),
        provider: 'mock',
        livemode: false,
        createdAt: clock.now(),
        type,
        data: {
          sessionId: r.sessionId,
          checkoutRef: r.checkoutRef,
          paymentStatus: r.paymentStatus,
          ...(r.paymentIntentId ? { paymentIntentId: r.paymentIntentId } : {}),
          amountTotalCents: r.amountTotalCents,
        },
      }
      await store.addEvent(event)
      return event
    },
  }
  return adapter
}
