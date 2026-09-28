// Sicherheits-Header je Kontext (ARCHITEKTUR §8.1, P2.12). Reine Funktionen ohne Framework-Importe und ohne
// Pfad-Aliasse (von `next.config.ts` geladen, ADR 0002). Anwendung:
// - `next.config.ts headers()`: allgemeine Header + CSP `public` für alle Pfade, CSP `api` für `/api/*`;
// - `src/proxy.ts`: Nonce-Kontexte `dynamic`, `checkout`, `admin` überschreiben CSP und ergänzen ihre Zusatz-Header.
import { matchRoute, splitLocale } from '../routes/paths'
import { xRobotsTag, type AppEnvName } from '../seo/robots'

import { buildCsp, type CspContext, type CspOptions, type NonceContext } from './csp'

export type HeaderMap = Record<string, string>

export const PERMISSIONS_POLICY =
  'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()'

/** Header für **alle** Antworten (§8.1). */
export function baseHeaders(appEnv: AppEnvName): HeaderMap {
  const h: HeaderMap = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Permissions-Policy': PERMISSIONS_POLICY,
  }
  if (appEnv === 'production' || appEnv === 'staging') {
    h['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
  }
  const robots = xRobotsTag(appEnv)
  if (robots) h['X-Robots-Tag'] = robots
  return h
}

export interface ContextHeaderOptions extends CspOptions {
  appEnv: AppEnvName
  /** Token-Seite (R08/R09) oder Dokument-Download: `no-referrer`, `private, no-store`, `noindex`. */
  tokenPage?: boolean
}

/** Header, die ein Kontext zusätzlich zu `baseHeaders` setzt bzw. überschreibt (inkl. CSP). */
export function contextHeaders(context: CspContext, o: ContextHeaderOptions): HeaderMap {
  const h: HeaderMap = { 'Content-Security-Policy': buildCsp(context, o) }
  if (context === 'dynamic' && o.tokenPage) {
    h['Referrer-Policy'] = 'no-referrer'
    h['Cache-Control'] = 'private, no-store'
    h['X-Robots-Tag'] = 'noindex, nofollow'
  }
  if (context === 'checkout') {
    h['Permissions-Policy'] = PERMISSIONS_POLICY.replace(
      'payment=()',
      o.paymentsDriver === 'stripe' ? 'payment=(self "https://js.stripe.com")' : 'payment=(self)',
    )
    h['Cross-Origin-Opener-Policy'] = 'same-origin-allow-popups'
    h['Cache-Control'] = 'private, no-store'
  }
  if (context === 'admin') {
    h['Permissions-Policy'] = PERMISSIONS_POLICY.replace('camera=()', 'camera=(self)')
    h['X-Robots-Tag'] = 'noindex, nofollow'
    h['Cache-Control'] = 'no-store'
  }
  return h
}

const toList = (h: HeaderMap) => Object.entries(h).map(([key, value]) => ({ key, value }))

/**
 * Regeln für `next.config.ts headers()`: alle Pfade `public`, `/api/*` `api` (spätere Regel überschreibt gleiche
 * Schlüssel). Nonce-Kontexte setzt der Proxy (seine Header haben Vorrang).
 */
export function staticHeaderRules(o: { appEnv: AppEnvName; nodeEnv?: string }) {
  return [
    {
      source: '/:path*',
      headers: toList({ ...baseHeaders(o.appEnv), ...contextHeaders('public', o) }),
    },
    { source: '/api/:path*', headers: toList(contextHeaders('api', o)) },
    // Versionierte Kunst-Dateien (Versionsnummer im Namen, DESIGN §10.4): dauerhaft cachebar.
    { source: IMMUTABLE_ART_SOURCE, headers: [{ key: 'Cache-Control', value: IMMUTABLE_CACHE }] },
  ]
}

/** Coco-Sprite `public/art/coco-sprite.v{N}.svg` – neue Zeichnungen bekommen eine neue Nummer. */
export const IMMUTABLE_ART_SOURCE = '/art/:file(coco-sprite\\.v\\d+\\.svg)'
export const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable'

export interface PathContext {
  context: NonceContext
  tokenPage: boolean
}

/**
 * Nonce-Kontext eines Seitenpfads mit Sprachpräfix laut Registry (`headerContext`), sonst `null` (= statisch
 * `public` aus `next.config.ts`). Der Verwaltungspfad wird im Proxy vorher erkannt.
 */
export function nonceContextForPath(pathname: string): PathContext | null {
  const split = splitLocale(pathname)
  if (!split) return null
  const match = matchRoute(split.rest, split.locale)
  if (!match || match.route.status !== 'live' || match.route.headerContext === 'public') return null
  return {
    context: match.route.headerContext,
    tokenPage: match.route.pageType === 'thankYou' || match.route.pageType === 'orderStatus',
  }
}
