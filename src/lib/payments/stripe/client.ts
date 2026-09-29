import 'server-only'

import Stripe from 'stripe'

import { STRIPE_API_VERSION, STRIPE_CLIENT_OPTIONS, stripeHostOptions } from './config'

// Einzige Stelle, an der das Node-Paket `stripe` konstruiert wird (check:static `stripe-import`: nur unter
// src/lib/payments/stripe/). Nach außen gehen keine SDK-Typen (ARCHITEKTUR §3.1 Nr. 4).

export { Stripe }

/** Die im gepinnten SDK hinterlegte API-Version (Test: = `STRIPE_API_VERSION`). */
export const SDK_API_VERSION: string = Stripe.API_VERSION

export interface StripeClientInput {
  secretKey: string
  /** `STRIPE_API_BASE_URL` (stripe-mock); leer → api.stripe.com. */
  baseUrl?: string
  /** Nur Tests: eigener HTTP-Client (z. B. `stripeFetchHttpClient(fakeFetch)`), sonst der Node-Client des SDK. */
  httpClient?: ReturnType<typeof Stripe.createFetchHttpClient>
}

/** Konfiguration des SDK-Clients (ARCHITEKTUR §3.5) – rein, damit Tests sie ohne Netz prüfen können. */
export function stripeClientConfig(i: Omit<StripeClientInput, 'secretKey'>) {
  return {
    apiVersion: STRIPE_API_VERSION,
    ...STRIPE_CLIENT_OPTIONS,
    appInfo: { ...STRIPE_CLIENT_OPTIONS.appInfo },
    ...stripeHostOptions(i.baseUrl),
    ...(i.httpClient ? { httpClient: i.httpClient } : {}),
  } satisfies ConstructorParameters<typeof Stripe>[1]
}

export function createStripeClient(i: StripeClientInput): Stripe {
  return new Stripe(i.secretKey, stripeClientConfig(i))
}

/** HTTP-Client auf Basis einer `fetch`-Funktion (Tests: Anfragen mitschneiden, ohne Netz). */
export function stripeFetchHttpClient(fetchFn: typeof fetch) {
  return Stripe.createFetchHttpClient(fetchFn)
}
