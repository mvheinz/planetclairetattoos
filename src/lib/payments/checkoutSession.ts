import 'server-only'

import {
  InvalidCheckoutSessionInputError,
  type CreateCheckoutSessionInput,
  type SessionState,
} from './types'

// Gemeinsame Regeln für das Anlegen einer Zahlungs-Session – für jeden Treiber gleich (ARCHITEKTUR §3.1 Nr. 6, §3.5;
// KONZEPT §4.7; DIENSTE Stripe „Pflicht-Konfiguration“). Der Stripe-Treiber (P4.5) sendet genau `buildSessionParams`;
// der Mock protokolliert dieselben Parameter (ohne `return_url` und E-Mail), damit Kontrakttests sie prüfen können.

/** Nur diese Zahlarten (R-062, E-20); Karte deckt Apple Pay und Google Pay ab. Keine `payment_method_configuration`. */
export const PAYMENT_METHOD_TYPES = ['card', 'paypal'] as const

/** Stripe: Ablauf frühestens 30 min, spätestens 24 h nach Erstellung. */
export const MIN_SESSION_MINUTES = 30
export const MAX_SESSION_HOURS = 24
/** Menge immer 1 (E-10); höchstens 10 Stücke je Kasse (DATENMODELL §6.25.1). */
export const MAX_LINE_ITEMS = 10

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

const fail = (message: string): never => {
  throw new InvalidCheckoutSessionInputError(message)
}

function assertCentsField(value: unknown, what: string): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    fail(`${what} muss ein Betrag in ganzen Cent ≥ 0 sein.`)
  }
}

/**
 * Prüft die Eingabe vor jedem Anbieter-Aufruf: `checkoutRef` ist die Kassen-Referenz (UUID v4, nie ein Token),
 * `metadata` enthält genau `{ checkoutRef, appEnv }`, Beträge in ganzen Cent, 1–10 Positionen, Ablauf 30 min–24 h.
 */
export function assertCheckoutSessionInput(i: CreateCheckoutSessionInput, now: Date): void {
  if (!UUID_V4.test(i.checkoutRef)) {
    fail('checkoutRef muss die Kassen-Referenz (UUID v4) sein – nie ein Token.')
  }
  const metaKeys = Object.keys(i.metadata).sort()
  if (metaKeys.join(',') !== 'appEnv,checkoutRef') {
    fail('metadata darf nur checkoutRef und appEnv enthalten.')
  }
  if (i.metadata.checkoutRef !== i.checkoutRef) {
    fail('metadata.checkoutRef muss checkoutRef entsprechen.')
  }
  if (!i.metadata.appEnv) fail('metadata.appEnv fehlt.')
  if (i.locale !== 'de' && i.locale !== 'en') fail('locale muss de oder en sein.')
  if (i.lineItems.length < 1 || i.lineItems.length > MAX_LINE_ITEMS) {
    fail(`Zwischen 1 und ${MAX_LINE_ITEMS} Positionen nötig.`)
  }
  for (const [n, l] of i.lineItems.entries()) {
    if (!l.name.trim()) fail(`Position ${n + 1}: Name fehlt.`)
    if (!Number.isInteger(l.productId) || l.productId <= 0) {
      fail(`Position ${n + 1}: productId ungültig.`)
    }
    assertCentsField(l.amountCents, `Position ${n + 1}: amountCents`)
  }
  if (!i.shipping.label.trim()) fail('Versand: Anzeigename fehlt.')
  assertCentsField(i.shipping.amountCents, 'Versand: amountCents')
  const expires = i.expiresAt.getTime()
  if (Number.isNaN(expires) || expires < now.getTime() + MIN_SESSION_MINUTES * 60_000) {
    fail(`expiresAt muss mindestens ${MIN_SESSION_MINUTES} Minuten in der Zukunft liegen.`)
  }
  if (expires > now.getTime() + MAX_SESSION_HOURS * 3_600_000) {
    fail(`expiresAt darf höchstens ${MAX_SESSION_HOURS} Stunden in der Zukunft liegen.`)
  }
  let url: URL | undefined
  try {
    url = new URL(i.returnUrl)
  } catch {
    fail('returnUrl muss eine absolute URL sein.')
  }
  if (url && url.protocol !== 'https:' && url.protocol !== 'http:') {
    fail('returnUrl muss http(s) sein.')
  }
}

/** Parameter für `checkout.sessions.create` (Form der gepinnten API-Version, ohne SDK-Typen). */
export interface SessionParams {
  ui_mode: 'elements'
  mode: 'payment'
  currency: 'eur'
  payment_method_types: (typeof PAYMENT_METHOD_TYPES)[number][]
  expires_at: number
  client_reference_id: string
  metadata: { checkoutRef: string; appEnv: string }
  locale: 'de' | 'en'
  return_url: string
  customer_email?: string
  line_items: {
    quantity: 1
    price_data: { currency: 'eur'; unit_amount: number; product_data: { name: string } }
  }[]
  shipping_options: [
    {
      shipping_rate_data: {
        type: 'fixed_amount'
        display_name: string
        fixed_amount: { amount: number; currency: 'eur' }
      }
    },
  ]
}

/** Einzige Quelle der Session-Parameter (KONZEPT §4.7). Kein success_url/cancel_url/submit_type/after_expiration. */
export function buildSessionParams(i: CreateCheckoutSessionInput): SessionParams {
  return {
    ui_mode: 'elements',
    mode: 'payment',
    currency: 'eur',
    payment_method_types: [...PAYMENT_METHOD_TYPES],
    expires_at: Math.floor(i.expiresAt.getTime() / 1000),
    client_reference_id: i.checkoutRef,
    metadata: { checkoutRef: i.metadata.checkoutRef, appEnv: i.metadata.appEnv },
    locale: i.locale,
    return_url: i.returnUrl,
    ...(i.customerEmail ? { customer_email: i.customerEmail } : {}),
    line_items: i.lineItems.map((l) => ({
      quantity: 1 as const,
      price_data: {
        currency: 'eur' as const,
        unit_amount: l.amountCents,
        product_data: { name: l.name },
      },
    })),
    shipping_options: [
      {
        shipping_rate_data: {
          type: 'fixed_amount',
          display_name: i.shipping.label,
          fixed_amount: { amount: i.shipping.amountCents, currency: 'eur' },
        },
      },
    ],
  }
}

export type LoggableSessionParams = Omit<
  SessionParams,
  'return_url' | 'customer_email' | 'line_items' | 'shipping_options'
> & { line_item_amounts: number[]; shipping_amount: number }

/**
 * Für Protokolle (ARCHITEKTUR §8.11): ohne `return_url` (enthält den Kassen-Token), ohne E-Mail und ohne Stücktitel.
 * Als Kennung bleibt nur `checkoutRef` (`client_reference_id`, `metadata`).
 */
export function loggableSessionParams(p: SessionParams): LoggableSessionParams {
  return {
    ui_mode: p.ui_mode,
    mode: p.mode,
    currency: p.currency,
    payment_method_types: [...p.payment_method_types],
    expires_at: p.expires_at,
    client_reference_id: p.client_reference_id,
    metadata: { ...p.metadata },
    locale: p.locale,
    line_item_amounts: p.line_items.map((l) => l.price_data.unit_amount),
    shipping_amount: p.shipping_options[0].shipping_rate_data.fixed_amount.amount,
  }
}

/** Idempotenz-Schlüssel der Anlage: `checkout:<checkoutRef>:<stripe.sessionSeq>` (ARCHITEKTUR §3.5). */
export function checkoutIdempotencyKey(checkoutRef: string, sessionSeq: number): string {
  return `checkout:${checkoutRef}:${sessionSeq}`
}

/** Idempotenz-Schlüssel einer Erstattung: `refund:<orderId>:<refundSeq>` (ARCHITEKTUR §3.5). */
export function refundIdempotencyKey(orderId: number | string, refundSeq: number): string {
  return `refund:${orderId}:${refundSeq}`
}

/**
 * Die Kasse speichert das Client-Secret nie (DATENMODELL §6.25.1), sondern holt es bei jedem Seitenaufruf über
 * `getCheckoutSession`. Fehlt es bei einer offenen Session, legt sie die Session mit derselben Reservierung neu an
 * (`stripe.sessionSeq + 1`, wie bei `recreate_required`).
 */
export function clientSecretMissing(state: SessionState): boolean {
  return state.status === 'open' && !state.clientSecret
}
