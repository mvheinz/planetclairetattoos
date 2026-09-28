import 'server-only'

// Gepinnte Stripe-API-Version (ARCHITEKTUR §3.5). Muss der Version entsprechen, die das exakt gepinnte SDK `stripe`
// 22.x mitbringt (`ApiVersion` in `stripe/esm/apiVersion.js`; P4.5 pinnt das Paket und prüft die Gleichheit). Der
// Webhook-Endpunkt bei Stripe wird mit derselben Version angelegt; die Fixtures unter `tests/fixtures/stripe/` tragen
// sie als `api_version` (`pnpm stripe:fixture` prüft das).
export const STRIPE_API_VERSION = '2026-08-26.dahlia'
