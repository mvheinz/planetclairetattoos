import 'server-only'

// Zahlungen ohne eigene Bestellung (U-58 a, J-26/J-27, KONZEPT §4.11 S16/S17): reine Konstanten und Regeln ohne
// Datenbank (auch für die Collection-Konfiguration und Tests).

/** `late` = Zahlung zu einer beendeten Kasse (S16), `double` = Karte/PayPal zusätzlich zur Vorkasse (S17). */
export const STRAY_PAYMENT_KINDS = ['late', 'double'] as const
export type StrayPaymentKind = (typeof STRAY_PAYMENT_KINDS)[number]

export const STRAY_REFUND_STATUSES = ['none', 'pending', 'succeeded', 'failed'] as const
export type StrayRefundStatus = (typeof STRAY_REFUND_STATUSES)[number]

/**
 * Idempotenz-Schlüssel beim Anbieter: genau eine Erstattung je Zahlung und Versuch, egal wie oft geklickt wird. Nach
 * einem fehlgeschlagenen Versuch zählt `attempt` hoch (Stripe würde sonst das alte Ergebnis wiederholen).
 */
export const strayRefundIdempotencyKey = (paymentIntentId: string, attempt: number) =>
  `stray-refund:${paymentIntentId}:${attempt}`

/** Darf (noch einmal) erstattet werden? „läuft“ und „erstattet“ nicht; „fehlgeschlagen“ ja (neuer Versuch). */
export function strayRefundOpen(status: string | null | undefined): boolean {
  return !status || status === 'none' || status === 'failed'
}
