import 'server-only'

import { z } from 'zod'

import {
  PaymentEventShapeError,
  type PaymentEvent,
  type PaymentEventType,
  type PaymentsDriver,
} from './types'

// Normalisierung von Stripe-Ereignissen (ARCHITEKTUR §3.1 Nr. 4, §3.5): dieselbe Funktion für den Stripe-Treiber
// (nach `constructEvent`) und den Mock (Fixtures mit ersetzten Werten). Nach außen gehen nur eigene Typen; die Daten
// sind je Typ mit zod geprüft und enthalten keine Personendaten (keine E-Mail, kein Name, keine Adresse).

/** Behandelte Stripe-Ereignisse (DATENMODELL §8.8 Nr. 4) → eigener Typ. Alles andere wird `ignored`. */
export const STRIPE_EVENT_TYPES = {
  'checkout.session.completed': 'checkout.completed',
  'checkout.session.async_payment_succeeded': 'checkout.async_succeeded',
  'checkout.session.async_payment_failed': 'checkout.async_failed',
  'checkout.session.expired': 'checkout.expired',
  'charge.refunded': 'charge.refunded',
  'refund.created': 'refund.created',
  'refund.updated': 'refund.updated',
  'refund.failed': 'refund.failed',
  'charge.dispute.created': 'dispute.created',
  'charge.dispute.closed': 'dispute.closed',
} as const satisfies Record<string, Exclude<PaymentEventType, 'ignored'>>

export type StripeEventType = keyof typeof STRIPE_EVENT_TYPES
export const STRIPE_EVENT_NAMES = Object.keys(STRIPE_EVENT_TYPES) as StripeEventType[]

export function isStripeEventType(value: string): value is StripeEventType {
  return Object.hasOwn(STRIPE_EVENT_TYPES, value)
}

// --- Rohform (Ausschnitt der gepinnten API-Version; unbekannte Felder werden verworfen) ---

const stripeId = (...prefixes: string[]) =>
  z
    .string()
    .regex(
      new RegExp(`^(?:${prefixes.join('|')})_[A-Za-z0-9_-]+$`),
      `ID mit Präfix ${prefixes.join('/')}_ erwartet`,
    )
/** Verweis als ID oder (expandiert) als Objekt mit `id`. */
const stripeRef = (...prefixes: string[]) =>
  z
    .union([stripeId(...prefixes), z.object({ id: stripeId(...prefixes) })])
    .transform((v) => (typeof v === 'string' ? v : v.id))
const minorUnits = z.number().int()
const unixSeconds = z.number().int().nonnegative()

const rawEnvelope = z.object({
  id: stripeId('evt'),
  object: z.literal('event'),
  type: z.string().min(1),
  created: unixSeconds,
  livemode: z.boolean(),
  data: z.object({ object: z.record(z.string(), z.unknown()) }),
})

const rawCheckoutSession = z.object({
  id: stripeId('cs'),
  object: z.literal('checkout.session'),
  client_reference_id: z.string().nullable(),
  metadata: z.record(z.string(), z.string()).nullable(),
  status: z.enum(['open', 'complete', 'expired']),
  payment_status: z.enum(['paid', 'unpaid', 'no_payment_required']),
  payment_intent: stripeRef('pi').nullable(),
  amount_total: minorUnits.nullable(),
  currency: z.string().nullable(),
  expires_at: unixSeconds,
})

const rawCharge = z.object({
  id: stripeId('ch', 'py'),
  object: z.literal('charge'),
  amount: minorUnits,
  amount_refunded: minorUnits,
  refunded: z.boolean(),
  currency: z.string(),
  payment_intent: stripeRef('pi').nullable(),
})

const rawRefund = z.object({
  id: stripeId('re', 'pyr'),
  object: z.literal('refund'),
  amount: minorUnits,
  currency: z.string(),
  charge: stripeRef('ch', 'py').nullable(),
  payment_intent: stripeRef('pi').nullable(),
  status: z.string().nullable(),
  failure_reason: z.string().nullable().optional(),
})

const rawDispute = z.object({
  id: stripeId('du', 'dp'),
  object: z.literal('dispute'),
  amount: minorUnits,
  currency: z.string(),
  charge: stripeRef('ch', 'py'),
  payment_intent: stripeRef('pi').nullable(),
  reason: z.string(),
  status: z.string(),
})

// --- Normalisierte Daten je Typ (Inhalt von PaymentEvent.data) ---

const base = { providerType: z.string().min(1) }

export const checkoutEventDataSchema = z.object({
  ...base,
  sessionId: z.string().min(1),
  /** = `checkouts.reservationRef` (aus `client_reference_id`, sonst `metadata.checkoutRef`); null bei fremden Sessions. */
  checkoutRef: z.string().nullable(),
  appEnv: z.string().nullable(),
  status: z.enum(['open', 'complete', 'expired']),
  paymentStatus: z.enum(['paid', 'unpaid', 'no_payment_required']),
  paymentIntentId: z.string().nullable(),
  amountTotalCents: z.number().int().nullable(),
  currency: z.string().nullable(),
  expiresAt: z.iso.datetime(),
})

export const chargeRefundedDataSchema = z.object({
  ...base,
  chargeId: z.string().min(1),
  paymentIntentId: z.string().nullable(),
  amountCents: z.number().int(),
  amountRefundedCents: z.number().int(),
  fullyRefunded: z.boolean(),
  currency: z.string(),
})

/** Stripe-Status `pending`/`requires_action` → `pending`, `succeeded` → `succeeded`, `failed`/`canceled` → `failed`. */
export const refundEventDataSchema = z.object({
  ...base,
  refundId: z.string().min(1),
  chargeId: z.string().nullable(),
  paymentIntentId: z.string().nullable(),
  amountCents: z.number().int(),
  status: z.enum(['pending', 'succeeded', 'failed']),
  providerStatus: z.string().nullable(),
  failureReason: z.string().nullable(),
  currency: z.string(),
})

export const disputeEventDataSchema = z.object({
  ...base,
  disputeId: z.string().min(1),
  chargeId: z.string().min(1),
  paymentIntentId: z.string().nullable(),
  amountCents: z.number().int(),
  reason: z.string(),
  status: z.string(),
  currency: z.string(),
})

export const ignoredEventDataSchema = z.object({ ...base })

export type CheckoutEventData = z.output<typeof checkoutEventDataSchema>
export type ChargeRefundedData = z.output<typeof chargeRefundedDataSchema>
export type RefundEventData = z.output<typeof refundEventDataSchema>
export type DisputeEventData = z.output<typeof disputeEventDataSchema>
export type IgnoredEventData = z.output<typeof ignoredEventDataSchema>

export const PAYMENT_EVENT_DATA_SCHEMAS = {
  'checkout.completed': checkoutEventDataSchema,
  'checkout.async_succeeded': checkoutEventDataSchema,
  'checkout.async_failed': checkoutEventDataSchema,
  'checkout.expired': checkoutEventDataSchema,
  'charge.refunded': chargeRefundedDataSchema,
  'refund.created': refundEventDataSchema,
  'refund.updated': refundEventDataSchema,
  'refund.failed': refundEventDataSchema,
  'dispute.created': disputeEventDataSchema,
  'dispute.closed': disputeEventDataSchema,
  ignored: ignoredEventDataSchema,
} as const satisfies Record<PaymentEventType, z.ZodType>

export type PaymentEventData<T extends PaymentEventType> = z.output<
  (typeof PAYMENT_EVENT_DATA_SCHEMAS)[T]
>

/** Typisierter, erneut geprüfter Zugriff auf `event.data` (z. B. in `processPaymentEvent`). */
export function paymentEventData<T extends PaymentEventType>(
  event: PaymentEvent & { type: T },
): PaymentEventData<T> {
  const parsed = PAYMENT_EVENT_DATA_SCHEMAS[event.type].safeParse(event.data)
  if (!parsed.success) {
    throw new PaymentEventShapeError(`Daten zu ${event.type} ungültig: ${issues(parsed.error)}`)
  }
  return parsed.data as PaymentEventData<T>
}

function issues(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((i) => `${i.path.join('.') || '(Wurzel)'}: ${i.message}`)
    .join('; ')
}

function parseOrThrow<S extends z.ZodType>(schema: S, value: unknown, what: string): z.output<S> {
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw new PaymentEventShapeError(`${what} ungültig: ${issues(parsed.error)}`)
  return parsed.data
}

function refundStatus(status: string | null): RefundEventData['status'] {
  if (status === 'succeeded') return 'succeeded'
  if (status === 'failed' || status === 'canceled') return 'failed'
  return 'pending'
}

function checkoutRefOf(s: z.output<typeof rawCheckoutSession>): string | null {
  const fromClient = s.client_reference_id
  const fromMeta = s.metadata?.checkoutRef ?? null
  if (fromClient && fromMeta && fromClient !== fromMeta) {
    throw new PaymentEventShapeError(
      'client_reference_id und metadata.checkoutRef widersprechen sich.',
    )
  }
  return fromClient ?? fromMeta
}

function normalizeData(
  providerType: StripeEventType,
  object: Record<string, unknown>,
): Record<string, unknown> {
  switch (providerType) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
    case 'checkout.session.async_payment_failed':
    case 'checkout.session.expired': {
      const s = parseOrThrow(rawCheckoutSession, object, `${providerType}: Checkout-Session`)
      return checkoutEventDataSchema.parse({
        providerType,
        sessionId: s.id,
        checkoutRef: checkoutRefOf(s),
        appEnv: s.metadata?.appEnv ?? null,
        status: s.status,
        paymentStatus: s.payment_status,
        paymentIntentId: s.payment_intent,
        amountTotalCents: s.amount_total,
        currency: s.currency,
        expiresAt: new Date(s.expires_at * 1000).toISOString(),
      } satisfies CheckoutEventData)
    }
    case 'charge.refunded': {
      const c = parseOrThrow(rawCharge, object, `${providerType}: Zahlung (charge)`)
      return chargeRefundedDataSchema.parse({
        providerType,
        chargeId: c.id,
        paymentIntentId: c.payment_intent,
        amountCents: c.amount,
        amountRefundedCents: c.amount_refunded,
        fullyRefunded: c.refunded,
        currency: c.currency,
      } satisfies ChargeRefundedData)
    }
    case 'refund.created':
    case 'refund.updated':
    case 'refund.failed': {
      const r = parseOrThrow(rawRefund, object, `${providerType}: Erstattung`)
      return refundEventDataSchema.parse({
        providerType,
        refundId: r.id,
        chargeId: r.charge,
        paymentIntentId: r.payment_intent,
        amountCents: r.amount,
        status: refundStatus(r.status),
        providerStatus: r.status,
        failureReason: r.failure_reason ?? null,
        currency: r.currency,
      } satisfies RefundEventData)
    }
    case 'charge.dispute.created':
    case 'charge.dispute.closed': {
      const d = parseOrThrow(rawDispute, object, `${providerType}: Zahlungsanfechtung`)
      return disputeEventDataSchema.parse({
        providerType,
        disputeId: d.id,
        chargeId: d.charge,
        paymentIntentId: d.payment_intent,
        amountCents: d.amount,
        reason: d.reason,
        status: d.status,
        currency: d.currency,
      } satisfies DisputeEventData)
    }
  }
}

/**
 * Stripe-Ereignis (bereits geparstes JSON, Signatur geprüft) → `PaymentEvent`. Wirft `PaymentEventShapeError`, wenn
 * Hülle oder ein behandelter Typ nicht die erwartete Form hat; unbekannte Typen werden `ignored`.
 */
export function normalizeStripeEvent(raw: unknown, provider: PaymentsDriver): PaymentEvent {
  const envelope = parseOrThrow(rawEnvelope, raw, 'Ereignis')
  const base = {
    id: envelope.id,
    provider,
    livemode: envelope.livemode,
    createdAt: new Date(envelope.created * 1000),
  }
  if (!isStripeEventType(envelope.type)) {
    return { ...base, type: 'ignored', data: { providerType: envelope.type } }
  }
  return {
    ...base,
    type: STRIPE_EVENT_TYPES[envelope.type],
    data: normalizeData(envelope.type, envelope.data.object),
  }
}
