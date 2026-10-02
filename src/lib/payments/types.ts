import 'server-only'

// Zahlungs-Adapter (ARCHITEKTUR §3.5). Eigene Typen, keine Anbieter-Typen nach außen (§3.1 Nr. 4).

export type PaymentsDriver = 'mock' | 'stripe'

export interface CreateCheckoutSessionInput {
  /** = checkouts.reservationRef (UUID), nie ein Token (§3.1 Nr. 6). */
  checkoutRef: string
  /**
   * = `checkouts.stripe.sessionSeq` dieser (Neu-)Anlage (1 bei der ersten, +1 je Neuanlage mit derselben Reservierung).
   * Idempotenz-Schlüssel `checkout:<checkoutRef>:<sessionSeq>` (ARCHITEKTUR §3.5).
   */
  sessionSeq: number
  locale: 'de' | 'en'
  /** Menge immer 1 (E-10). */
  lineItems: { productId: number; name: string; amountCents: number }[]
  /** Genau eine Option (KONZEPT §4.7). */
  shipping: { label: string; amountCents: number }
  /** ≥ 30 min nach Erstellung (Stripe). */
  expiresAt: Date
  /** Danke-Seite mit Kassen-Token (`checkoutReturnUrl`) – einzige Stelle mit Token. */
  returnUrl: string
  customerEmail?: string
  /** Nie ein Token (§3.1 Nr. 6). */
  metadata: { checkoutRef: string; appEnv: string }
}

export interface CheckoutSessionHandle {
  sessionId: string
  clientSecret: string
  expiresAt: Date
}

export type SessionState = {
  sessionId: string
  status: 'open' | 'complete' | 'expired'
  paymentStatus: 'paid' | 'unpaid' | 'no_payment_required'
  /** Nur bei 'open'; nie gespeichert – bei jedem Laden der Kasse neu geholt. */
  clientSecret?: string
  paymentIntentId?: string
  /** Belastung (`ch_…`/`py_…`), sobald bezahlt. */
  chargeId?: string
  amountTotalCents?: number
  paymentMethod?: { type: 'card' | 'paypal'; wallet?: 'apple_pay' | 'google_pay' }
}

export type ExpireResult =
  'expired' | 'already_expired' | 'already_complete_paid' | 'already_complete_unpaid'

export const PAYMENT_EVENT_TYPES = [
  'checkout.completed',
  'checkout.async_succeeded',
  'checkout.async_failed',
  'checkout.expired',
  'charge.refunded',
  'refund.created',
  'refund.updated',
  'refund.failed',
  'dispute.created',
  'dispute.closed',
  'ignored',
] as const
export type PaymentEventType = (typeof PAYMENT_EVENT_TYPES)[number]

export type PaymentEvent = {
  id: string
  provider: PaymentsDriver
  livemode: boolean
  createdAt: Date
  type: PaymentEventType
  /** Normalisiert, zod-validiert je Typ (`src/lib/payments/normalize.ts`, `paymentEventData`). */
  data: Record<string, unknown>
}

export interface RefundInput {
  paymentIntentId: string
  amountCents: number
  reason: string
  idempotencyKey: string
}

export interface RefundResult {
  refundId: string
  status: 'pending' | 'succeeded' | 'failed'
}

export interface BalanceTransaction {
  id: string
  sourceId: string
  feeCents: number
  netCents: number
  payoutId?: string
  payoutDate?: Date
}

export interface PaymentsAdapter {
  readonly driver: PaymentsDriver
  readonly mode: 'mock' | 'test' | 'live'
  createCheckoutSession(i: CreateCheckoutSessionInput): Promise<CheckoutSessionHandle>
  updateShipping(
    sessionId: string,
    s: { label: string; amountCents: number },
  ): Promise<'updated' | 'recreate_required'>
  expireCheckoutSession(sessionId: string): Promise<ExpireResult>
  getCheckoutSession(sessionId: string): Promise<SessionState>
  refund(i: RefundInput): Promise<RefundResult>
  /** Wirft InvalidSignatureError. */
  parseWebhook(rawBody: string, headers: Headers): PaymentEvent
  /** Abgleich fehlender Webhooks (§11). */
  listEventsSince(since: Date): Promise<PaymentEvent[]>
  /** Monatsexport (KONZEPT §7.15). */
  listBalanceTransactions(i: { from: Date; to: Date }): Promise<BalanceTransaction[]>
}

export class InvalidSignatureError extends Error {
  constructor(message = 'Webhook-Signatur ungültig.') {
    super(message)
    this.name = 'InvalidSignatureError'
  }
}

/** Signatur gültig, aber das Ereignis hat nicht die Form der gepinnten API-Version (Normalisierung, zod). */
export class PaymentEventShapeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PaymentEventShapeError'
  }
}

/** Eingabe für `createCheckoutSession` verletzt eine Regel aus ARCHITEKTUR §3.1 Nr. 6 / §3.5 (für alle Treiber). */
export class InvalidCheckoutSessionInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidCheckoutSessionInputError'
  }
}

export class PaymentSessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`Zahlungs-Session ${sessionId} unbekannt.`)
    this.name = 'PaymentSessionNotFoundError'
  }
}

export class NotImplementedYetError extends Error {
  constructor(what: string, phase: string) {
    super(`${what} ist noch nicht umgesetzt (folgt in ${phase}).`)
    this.name = 'NotImplementedYetError'
  }
}
