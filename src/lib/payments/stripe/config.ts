import 'server-only'

import { ConfigError } from '../../errors'

// Gepinnte Stripe-API-Version (ARCHITEKTUR §3.5) = `ApiVersion` des exakt gepinnten SDK `stripe` 22.6.2
// (`stripe/esm/apiVersion.js`, bestätigt in P4.5; ein Unit-Test vergleicht mit `Stripe.API_VERSION`). Der
// Webhook-Endpunkt bei Stripe wird mit derselben Version angelegt; die Fixtures unter `tests/fixtures/stripe/` tragen
// sie als `api_version` (`pnpm stripe:fixture` prüft das). Beim SDK-Update Version, Fixtures und Endpunkt gemeinsam ändern.
export const STRIPE_API_VERSION = '2026-08-26.dahlia'

/** Client-Einstellungen (ARCHITEKTUR §3.5). `telemetry: false`: keine Latenz-Kopfzeilen an Stripe (Datensparsamkeit). */
export const STRIPE_CLIENT_OPTIONS = {
  maxNetworkRetries: 2,
  timeout: 10_000,
  appInfo: { name: 'planetclaire' },
  telemetry: false,
} as const

/**
 * Ergebnis Spike B-07 (ARCHITEKTUR Anhang B): Die gepinnte API-Version erlaubt `checkout.sessions.update` mit neuen
 * `shipping_options` ohne Einschränkung auf einen `ui_mode` (OpenAPI 2026-08-26.dahlia, SDK-Typen, stripe-mock);
 * Stripe.js 9.x bietet dafür `checkout.runServerUpdate()`. Soll daher `'update'`. Lehnt Stripe die Änderung ab, meldet
 * der Treiber ohnehin `recreate_required`. `'recreate'` schaltet die Rückfallebene fest ein (immer neu anlegen).
 */
export const UPDATE_SHIPPING_STRATEGY: 'update' | 'recreate' = 'update'

/** Toleranz der Webhook-Signatur in Sekunden (Stripe-Standard). */
export const WEBHOOK_TOLERANCE_SECONDS = 300

/** Obergrenze für Listen-Abrufe (Ereignisse, Salden), damit ein Abgleich nie endlos blättert. */
export const MAX_LIST_ITEMS = 10_000

export interface StripeHostOptions {
  host: string
  port: string
  protocol: 'http' | 'https'
}

/**
 * `STRIPE_API_BASE_URL` (nur Tests gegen stripe-mock, z. B. `http://127.0.0.1:12111`) → Host/Port/Protokoll des SDK.
 * Leer → Stripe selbst. Nur http(s) ohne Pfad, Query oder Fragment.
 */
export function stripeHostOptions(baseUrl: string | undefined): StripeHostOptions | undefined {
  if (!baseUrl) return undefined
  let url: URL
  try {
    url = new URL(baseUrl)
  } catch {
    throw new ConfigError('STRIPE_API_BASE_URL ist keine gültige URL.')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ConfigError('STRIPE_API_BASE_URL muss mit http:// oder https:// beginnen.')
  }
  if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new ConfigError('STRIPE_API_BASE_URL darf nur Protokoll, Host und Port enthalten.')
  }
  const protocol = url.protocol === 'http:' ? 'http' : 'https'
  return { host: url.hostname, port: url.port || (protocol === 'http' ? '80' : '443'), protocol }
}
