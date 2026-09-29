import 'server-only'

import type { PaymentEvent, PaymentEventType, RefundResult, SessionState } from '../types'

// Zustand des Mock-Treibers in `checkouts.mock.state` (DATENMODELL §6.25.1, ARCHITEKTUR §3.5) – in der DB, nicht im
// Prozess: Danke-Seite, Jobs und mehrere Instanzen sehen denselben Stand. Eine Kasse kann mehrere Sessions haben
// (Neuanlage mit derselben Reservierung, `stripe.sessionSeq + 1`). Keine Personendaten, kein Token, kein Client-Secret
// (das Mock-Secret wird aus der Session-ID abgeleitet). Ereignisse stehen als Protokoll für `listEventsSince`; die
// Ablage in `webhook-events` (provider = 'mock') übernimmt die Verarbeitung (`processPaymentEvent`, DATENMODELL §8.8).

export const MOCK_STATE_VERSION = 1

export type MockPaymentMethod = { type: 'card' | 'paypal'; wallet?: 'apple_pay' | 'google_pay' }

/** Ergebnis-Auswahl des Test-Zahlungsfelds (ARCHITEKTUR §3.5): Erfolg · Abgelehnt · Abbruch · Verzögert. */
export const MOCK_OUTCOMES = ['success', 'declined', 'cancelled', 'delayed'] as const
export type MockOutcome = (typeof MOCK_OUTCOMES)[number]

/** Nächstes Test-Ergebnis einer Session (`mockPayments.setNextOutcome`). */
export interface MockNextOutcome {
  /** `delayed` → `checkout.session.completed` mit `unpaid`; `declined`/`cancelled` → kein `completed`-Ereignis. */
  result?: MockOutcome
  /** Zahlart der nächsten Zahlung (Standard `card`). */
  paymentMethod?: MockPaymentMethod
  /** Ergebnis der nächsten Erstattung (Standard `succeeded`). */
  refund?: RefundResult['status']
  /** Ausgang der nächsten Zahlungsanfechtung (Standard `lost`). */
  dispute?: 'won' | 'lost'
}

export interface MockSession {
  sessionId: string
  status: SessionState['status']
  paymentStatus: SessionState['paymentStatus']
  locale: 'de' | 'en'
  amountSubtotalCents: number
  shippingCents: number
  shippingLabel: string
  amountTotalCents: number
  createdAt: string
  expiresAt: string
  paymentIntentId?: string
  chargeId?: string
  paymentMethod?: MockPaymentMethod
  completedAt?: string
  nextOutcome?: MockNextOutcome
}

export interface MockRefund {
  refundId: string
  idempotencyKey: string
  sessionId: string
  paymentIntentId: string
  chargeId: string
  amountCents: number
  status: RefundResult['status']
  reason: string
  createdAt: string
}

export interface MockDispute {
  disputeId: string
  sessionId: string
  chargeId: string
  paymentIntentId: string
  amountCents: number
  status: 'needs_response' | 'won' | 'lost'
  createdAt: string
}

/** Protokolliertes, bereits normalisiertes Ereignis (JSON-fähig). */
export interface MockStoredEvent {
  id: string
  type: PaymentEventType
  livemode: false
  createdAt: string
  data: Record<string, unknown>
}

export interface MockState {
  v: typeof MOCK_STATE_VERSION
  checkoutRef: string
  appEnv: string
  sessions: MockSession[]
  refunds: MockRefund[]
  disputes: MockDispute[]
  events: MockStoredEvent[]
}

export function emptyMockState(checkoutRef: string, appEnv: string): MockState {
  return {
    v: MOCK_STATE_VERSION,
    checkoutRef,
    appEnv,
    sessions: [],
    refunds: [],
    disputes: [],
    events: [],
  }
}

/** Liest den gespeicherten Zustand; fremde/alte Formen gelten als leer. */
export function parseMockState(raw: unknown): MockState | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Partial<MockState>
  if (s.v !== MOCK_STATE_VERSION || typeof s.checkoutRef !== 'string') return null
  return {
    v: MOCK_STATE_VERSION,
    checkoutRef: s.checkoutRef,
    appEnv: typeof s.appEnv === 'string' ? s.appEnv : 'development',
    sessions: Array.isArray(s.sessions) ? s.sessions : [],
    refunds: Array.isArray(s.refunds) ? s.refunds : [],
    disputes: Array.isArray(s.disputes) ? s.disputes : [],
    events: Array.isArray(s.events) ? s.events : [],
  }
}

export function toStoredEvent(e: PaymentEvent): MockStoredEvent {
  return {
    id: e.id,
    type: e.type,
    livemode: false,
    createdAt: e.createdAt.toISOString(),
    data: e.data,
  }
}

export function fromStoredEvent(e: MockStoredEvent): PaymentEvent {
  return {
    id: e.id,
    provider: 'mock',
    livemode: false,
    createdAt: new Date(e.createdAt),
    type: e.type,
    data: e.data,
  }
}
