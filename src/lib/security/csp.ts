// Content-Security-Policy je Kontext (ARCHITEKTUR §8.1, P2.12, Spike B-03). Reine Funktionen ohne Framework-Importe
// und ohne Pfad-Aliasse: `next.config.ts` (statische Kontexte `public`, `api`), `src/proxy.ts` (Nonce-Kontexte
// `dynamic`, `checkout`, `admin`) und Tests laden diese Datei. Keine Geheimnisse – deshalb ohne `server-only`
// (Ausnahme in `scripts/lib/static-checks/import-rules.ts`, ADR 0002).
//
// Fremde Hosts stehen nur in `CSP_HOSTS` und sind eine Teilmenge der DIENSTE-YAML (`docs/recht/DIENSTE.md` §7) für
// denselben Kontext (R-131, Unit-Test). Heute: ausschließlich Stripe auf der Kasse bei `PAYMENTS_DRIVER=stripe`.
import { MOTION_SCRIPT_HASH } from './inlineScripts'

export const CSP_CONTEXTS = ['public', 'dynamic', 'checkout', 'admin', 'api'] as const
export type CspContext = (typeof CSP_CONTEXTS)[number]
export type NonceContext = Extract<CspContext, 'dynamic' | 'checkout' | 'admin'>
export const NONCE_CONTEXTS: readonly NonceContext[] = ['dynamic', 'checkout', 'admin']

type Directives = Record<string, string[]>

/** Fremd-Hosts je Kontext und Direktive, nur bei aktivem Treiber (DIENSTE-YAML `csp.<kontext>.<direktive>`). */
export const CSP_HOSTS: Record<
  CspContext,
  { service: string; driver?: { env: string; value: string }; directives: Directives }[]
> = {
  public: [],
  dynamic: [],
  checkout: [
    {
      service: 'stripe',
      driver: { env: 'PAYMENTS_DRIVER', value: 'stripe' },
      directives: {
        'script-src': ['https://js.stripe.com', 'https://*.js.stripe.com'],
        'frame-src': [
          'https://js.stripe.com',
          'https://*.js.stripe.com',
          'https://hooks.stripe.com',
        ],
        'connect-src': ['https://api.stripe.com'],
      },
    },
  ],
  admin: [],
  api: [],
}

/**
 * Ergebnis Spike B-03 (ARCHITEKTUR Anhang B, ADR 0002): Statische App-Router-Seiten enthalten Inline-Skripte mit den
 * RSC-Daten (`self.__next_f.push(…)`), deren Text je Seite und Build wechselt; `experimental.sri` versieht nur die
 * `<script src>`-Dateien mit `integrity`. Ohne Nonce (statisch) bleibt deshalb nur die Rückfallebene
 * `'unsafe-inline'` im Kontext `public` – Hosts weiter nur `'self'` (R-131, Kanzleifrage K-41). Der Hash von
 * `pc-motion` darf dann **nicht** mit in `script-src` stehen: Browser ignorieren `'unsafe-inline'`, sobald ein Hash
 * oder eine Nonce vorhanden ist.
 */
export const PUBLIC_SCRIPT_POLICY: 'hash' | 'unsafe-inline' = 'unsafe-inline'

/**
 * Ergebnis CSP-Teil Spike B-01 (ARCHITEKTUR Anhang B): Die Verwaltung läuft mit Nonce und `'strict-dynamic'`
 * (Login, Liste, Bearbeiten ohne CSP-Verstoß, `tests/e2e/security-headers.e2e.spec.ts`).
 */
export const ADMIN_SCRIPT_POLICY: 'nonce' | 'unsafe-inline' = 'nonce'

export interface CspOptions {
  /** Nonce je Anfrage (nur Nonce-Kontexte). */
  nonce?: string
  appEnv: string
  /** `process.env.NODE_ENV` – `next dev` braucht `'unsafe-eval'`. */
  nodeEnv?: string
  paymentsDriver?: string
}

const isDevelopment = (o: CspOptions) => o.appEnv === 'development' || o.nodeEnv === 'development'
/** Nur ausgelieferte Umgebungen laufen über HTTPS (lokal/CI: http://localhost). */
const upgradesInsecure = (o: CspOptions) =>
  o.appEnv === 'production' || o.appEnv === 'staging' || o.appEnv === 'preview'

function scriptSrc(context: CspContext, o: CspOptions): string[] {
  const nonce = () => {
    if (!o.nonce) throw new Error(`CSP-Kontext ${context} braucht eine Nonce`)
    return `'nonce-${o.nonce}'`
  }
  switch (context) {
    case 'public':
      return PUBLIC_SCRIPT_POLICY === 'hash'
        ? ["'self'", MOTION_SCRIPT_HASH]
        : ["'self'", "'unsafe-inline'"]
    case 'dynamic':
    case 'checkout':
      // `pc-motion` steht im gemeinsamen Wurzel-Layout ohne Nonce → zusätzlich sein Hash (ADR 0002).
      return ["'self'", nonce(), "'strict-dynamic'", MOTION_SCRIPT_HASH]
    case 'admin':
      return ADMIN_SCRIPT_POLICY === 'nonce'
        ? ["'self'", nonce(), "'strict-dynamic'"]
        : ["'self'", "'unsafe-inline'"]
    case 'api':
      return []
  }
}

/** Fremd-Hosts eines Kontexts für die aktiven Treiber. */
export function activeHosts(
  context: CspContext,
  o: Pick<CspOptions, 'paymentsDriver'>,
): Directives {
  const out: Directives = {}
  for (const entry of CSP_HOSTS[context]) {
    if (entry.driver?.env === 'PAYMENTS_DRIVER' && o.paymentsDriver !== entry.driver.value) continue
    for (const [directive, hosts] of Object.entries(entry.directives)) {
      out[directive] = [...(out[directive] ?? []), ...hosts]
    }
  }
  return out
}

/** Direktiven eines Kontexts (geordnet) laut Tabelle §8.1. */
export function cspDirectives(context: CspContext, o: CspOptions): Directives {
  if (context === 'api') return { 'default-src': ["'none'"], 'frame-ancestors': ["'none'"] }

  const d: Directives = {
    'default-src': ["'self'"],
    'script-src': scriptSrc(context, o),
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'"],
    'connect-src': ["'self'"],
  }
  if (context === 'admin') {
    d['worker-src'] = ["'self'"]
    d['manifest-src'] = ["'self'"]
  } else {
    d['media-src'] = ["'self'"]
    d['frame-src'] = ["'none'"]
    d['worker-src'] = ["'none'"]
    d['manifest-src'] = ["'self'"]
  }
  d['object-src'] = ["'none'"]
  d['base-uri'] = ["'self'"]
  d['form-action'] = ["'self'"]
  d['frame-ancestors'] = ["'none'"]

  for (const [directive, hosts] of Object.entries(activeHosts(context, o))) {
    const current = (d[directive] ?? []).filter((v) => v !== "'none'")
    d[directive] = [...current, ...hosts]
  }
  if (isDevelopment(o)) d['script-src'] = [...d['script-src']!, "'unsafe-eval'"]
  if (upgradesInsecure(o) && context !== 'admin') d['upgrade-insecure-requests'] = []
  return d
}

export function serializeCsp(directives: Directives): string {
  return Object.entries(directives)
    .map(([k, v]) => (v.length ? `${k} ${v.join(' ')}` : k))
    .join('; ')
}

export function buildCsp(context: CspContext, o: CspOptions): string {
  return serializeCsp(cspDirectives(context, o))
}

/** Zufällige Nonce je Anfrage (128 Bit, Base64). */
export function createNonce(): string {
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}
