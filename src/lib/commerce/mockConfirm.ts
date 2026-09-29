import 'server-only'

import { createHash } from 'node:crypto'

import config from '@payload-config'
import { getPayload, type Payload } from 'payload'

import { getPaymentsAdapter } from '@/lib/payments'
import {
  isMockPaymentsAdapter,
  type MockOutcome,
  type MockPaymentMethod,
} from '@/lib/payments/mock'
import { processPaymentEvent } from '@/lib/payments/processPaymentEvent'
import type { PaymentsAdapter } from '@/lib/payments/types'
import { localizedPath } from '@/lib/routes/paths'

import { reopenCheckout } from './changeDelivery'
import { findCheckoutByToken } from './checkout'

// Mock-Zahlung „Erfolg“ (KONZEPT §4.7, PLAN P4.16a): setzt die Mock-Session auf `complete`/`paid`, erzeugt
// `checkout.session.completed` und verarbeitet es mit derselben Funktion wie der Webhook (`processPaymentEvent`) –
// Bestand und Bestellung ändern sich also nur über den Ereignisweg, nie über die Rückkehr-URL (DATENMODELL §8.8 Nr. 5).
// Danach leitet die Server-Action `mockConfirm` (P4.10b, Kasse R07) mit 303 auf die Danke-Seite (R08, P4.17) weiter.
// Die übrigen Wege (P4.10b, `mockConfirmOutcome`): „Abgelehnt“ → Kasse `confirming → open`, Fehler im Zahlungsfeld (S8);
// „Abbruch (wie PayPal zurück)“ → Session bleibt `open`, Danke-Seite im Zustand „nicht bezahlt“ (S9); „Verzögert“ →
// Session `complete`/`unpaid` ohne Ereignis, Danke-Seite „wartet“, die Kasse bleibt `confirming` bis zum Abgleich (S10).
// Keiner dieser Wege erzeugt eine Bestellung.

export type MockConfirmSuccessResult =
  | {
      ok: true
      /** `/de/danke/<Kassen-Token>` bzw. `/en/thank-you/<Kassen-Token>`. */
      redirectTo: string
      orderId: number | null
      status: string
    }
  | { ok: false; code: 'not_found' | 'not_open' | 'no_session' | 'not_mock' }

export interface MockConfirmDeps {
  payload?: Payload
  payments?: PaymentsAdapter
}

/** Mock-„Erfolg“ für die Kasse zum Token (aus `pc_checkout`). */
export async function mockConfirmSuccess(
  input: { token: string; method?: MockPaymentMethod; now: Date },
  deps: MockConfirmDeps = {},
): Promise<MockConfirmSuccessResult> {
  const payload = deps.payload ?? (await getPayload({ config }))
  const payments = deps.payments ?? getPaymentsAdapter()
  if (!isMockPaymentsAdapter(payments)) return { ok: false, code: 'not_mock' }
  const checkout = await findCheckoutByToken(payload, input.token)
  if (!checkout) return { ok: false, code: 'not_found' }
  if (checkout.status !== 'open' && checkout.status !== 'confirming') {
    return { ok: false, code: 'not_open' }
  }
  const sessionId = checkout.stripe?.checkoutSessionId
  if (!sessionId) return { ok: false, code: 'no_session' }

  await payments.setNextOutcome(sessionId, {
    result: 'success',
    ...(input.method ? { paymentMethod: input.method } : {}),
  })
  const emission = await payments.emit(sessionId, 'checkout.session.completed')
  const result = await processPaymentEvent(emission.event, {
    payload,
    payments,
    now: input.now,
    payloadSha256: createHash('sha256').update(emission.rawBody).digest('hex'),
  })
  return {
    ok: true,
    redirectTo: localizedPath('R08', checkout.locale, { token: input.token }),
    orderId: result.orderId ?? null,
    status: result.status,
  }
}

/** Test-Zahlart des Mock-Felds (KONZEPT §4.7): Karte, Apple Pay, Google Pay, PayPal. */
export const MOCK_TEST_METHODS = ['card', 'apple_pay', 'google_pay', 'paypal'] as const
export type MockTestMethod = (typeof MOCK_TEST_METHODS)[number]

export function mockPaymentMethodOf(method: string | null | undefined): MockPaymentMethod {
  switch (method) {
    case 'apple_pay':
    case 'google_pay':
      return { type: 'card', wallet: method }
    case 'paypal':
      return { type: 'paypal' }
    default:
      return { type: 'card' }
  }
}

export type MockConfirmOutcomeResult =
  | MockConfirmSuccessResult
  | { ok: false; code: 'declined' }
  | { ok: false; code: 'expired' | 'payment_complete' | 'not_confirming' }

/** Mock-Bestätigung mit Test-Ergebnis (Erfolg · Abgelehnt · Abbruch · Verzögert) für die Kasse zum Token. */
export async function mockConfirmOutcome(
  input: { token: string; outcome: MockOutcome; method?: MockPaymentMethod; now: Date },
  deps: MockConfirmDeps = {},
): Promise<MockConfirmOutcomeResult> {
  if (input.outcome === 'success') return mockConfirmSuccess(input, deps)
  const payload = deps.payload ?? (await getPayload({ config }))
  const payments = deps.payments ?? getPaymentsAdapter()
  if (!isMockPaymentsAdapter(payments)) return { ok: false, code: 'not_mock' }
  const checkout = await findCheckoutByToken(payload, input.token)
  if (!checkout) return { ok: false, code: 'not_found' }
  if (checkout.status !== 'open' && checkout.status !== 'confirming') {
    return { ok: false, code: 'not_open' }
  }
  const sessionId = checkout.stripe?.checkoutSessionId
  if (!sessionId) return { ok: false, code: 'no_session' }
  const redirectTo = localizedPath('R08', checkout.locale, { token: input.token })

  switch (input.outcome) {
    case 'declined': {
      // Karte abgelehnt: kein Ereignis, Session bleibt offen; die Kasse geht zurück auf `open` (S8).
      if (checkout.status === 'confirming') {
        const reopened = await reopenCheckout(
          { token: input.token, now: input.now },
          { payload, payments },
        )
        if (!reopened.ok && reopened.code !== 'not_confirming') {
          return { ok: false, code: reopened.code === 'not_found' ? 'not_found' : reopened.code }
        }
      }
      return { ok: false, code: 'declined' }
    }
    case 'cancelled':
      // Wie „PayPal zurück“: nichts ändert sich beim Anbieter; die Danke-Seite zeigt „nicht bezahlt“ (S9).
      return { ok: true, redirectTo, orderId: null, status: 'cancelled' }
    case 'delayed':
      await payments.completeUnpaidWithoutEvent(sessionId, input.method)
      return { ok: true, redirectTo, orderId: null, status: 'delayed' }
  }
}
