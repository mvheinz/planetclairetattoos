import 'server-only'

import type { Env } from '@/lib/env'
import { ConfigError } from '@/lib/errors'

import { NotImplementedYetError, type PaymentsAdapter } from '../types'

// Stripe-Treiber – Gerüst (ARCHITEKTUR §3.5). Die Umsetzung mit dem Stripe-SDK folgt in P4; bis dahin bricht der
// Treiber ohne Schlüssel mit klarer Meldung ab und meldet mit Schlüssel „folgt in P4“. Das Paket `stripe` wird nur unter
// src/lib/payments/stripe/ importiert (check:static).

export function stripeMode(secretKey: string): 'test' | 'live' {
  return /^(sk|rk)_live_/.test(secretKey) ? 'live' : 'test'
}

export function createStripeAdapter(
  env: Pick<Env, 'STRIPE_SECRET_KEY' | 'STRIPE_WEBHOOK_SECRET'>,
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
  const later = (what: string) => () => Promise.reject(new NotImplementedYetError(what, 'P4'))
  return {
    driver: 'stripe',
    mode: stripeMode(key),
    createCheckoutSession: later('Stripe: Session anlegen'),
    updateShipping: later('Stripe: Versand aktualisieren'),
    expireCheckoutSession: later('Stripe: Session beenden'),
    getCheckoutSession: later('Stripe: Session abrufen'),
    refund: later('Stripe: Erstattung'),
    parseWebhook: () => {
      throw new NotImplementedYetError('Stripe: Webhook prüfen', 'P4')
    },
    listEventsSince: later('Stripe: Ereignisse abrufen'),
    listBalanceTransactions: later('Stripe: Gebühren abrufen'),
  }
}
