// Pfad-Helfer auf Basis der Routen-Registry (ARCHITEKTUR §2.3). Rein, ohne Framework-Importe und ohne Pfad-Aliasse,
// damit Proxy, `next.config.ts`, Tests und Vorschau-Export sie nutzen können.
import { LOCALES, ROUTES, aliases, type Locale, type RouteEntry } from './registry'

export type RouteParams = Record<string, string>

/**
 * Listen mit statischen Varianten (ARCHITEKTUR §9.1, Spike B-05): Shop, Kategorie, Archiv; seit P7 auch Flash (R12,
 * `?available=1`) und Galerie (R15, `?kind=fresh|healed`) mit derselben Technik.
 */
export const LIST_ROUTE_IDS = ['R02', 'R03', 'R05', 'R12', 'R15'] as const
export type ListRouteId = (typeof LIST_ROUTE_IDS)[number]
/** Internes Segment der Varianten-Seiten (`[locale]/shop/variant/[variant]`); nie sichtbar. */
export const LIST_VARIANT_SEGMENT = 'variant'

export const isLocale = (value: string | undefined): value is Locale =>
  (LOCALES as readonly string[]).includes(value ?? '')

export function getRoute(id: string): RouteEntry {
  const route = ROUTES.find((r) => r.id === id)
  if (!route) throw new Error(`Unbekannte Route ${id}`)
  return route
}

/** Seiten mit eigenem Muster (R01–R27). */
export const pageRoutes = (): RouteEntry[] =>
  ROUTES.filter((r): r is RouteEntry & { paths: Record<Locale, string>; key: string } =>
    Boolean(r.paths && r.key),
  )

const PARAM = /\[([a-zA-Z]+)\]/g

/** Setzt Parameter in ein Muster ein (`/danke/[token]` → `/danke/abc`). */
export function fillPattern(pattern: string, params: RouteParams = {}): string {
  return pattern.replace(PARAM, (_, name: string) => {
    const value = params[name]
    if (value === undefined || value === '')
      throw new Error(`Parameter ${name} fehlt für ${pattern}`)
    return encodeURIComponent(value)
  })
}

/** Pfad mit Sprachpräfix: `localizedPath('R21','de')` → `/de/impressum`, R01 → `/de`. */
export function localizedPath(id: string, locale: Locale, params: RouteParams = {}): string {
  const route = getRoute(id)
  if (!route.paths) throw new Error(`Route ${id} hat kein Seitenmuster`)
  const path = fillPattern(route.paths[locale], params)
  return path === '/' ? `/${locale}` : `/${locale}${path}`
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|\\]/g, '\\$&')

function compile(pattern: string): { regex: RegExp; names: string[] } {
  const names: string[] = []
  let source = ''
  let last = 0
  for (const m of pattern.matchAll(PARAM)) {
    source += escapeRegex(pattern.slice(last, m.index))
    source += '([^/]+?)'
    names.push(m[1]!)
    last = m.index + m[0].length
  }
  source += escapeRegex(pattern.slice(last))
  return { regex: new RegExp(`^${source}$`), names }
}

const compiled = new Map<string, ReturnType<typeof compile>>()
const compiledFor = (pattern: string) => {
  let c = compiled.get(pattern)
  if (!c) {
    c = compile(pattern)
    compiled.set(pattern, c)
  }
  return c
}

export interface RouteMatch {
  route: RouteEntry
  params: RouteParams
}

/**
 * Sucht die Route zu einem Pfad **ohne** Sprachpräfix im Muster der Sprache `locale` (`/` = Startseite).
 * Statische Muster haben Vorrang vor Mustern mit Parametern.
 */
export function matchRoute(pathWithoutLocale: string, locale: Locale): RouteMatch | null {
  const candidates = pageRoutes().sort(
    (a, b) => Number(a.paths![locale].includes('[')) - Number(b.paths![locale].includes('[')),
  )
  for (const route of candidates) {
    const { regex, names } = compiledFor(route.paths![locale])
    const m = regex.exec(pathWithoutLocale)
    if (!m) continue
    const params: RouteParams = {}
    names.forEach((n, i) => {
      params[n] = decodeURIComponent(m[i + 1]!)
    })
    return { route, params }
  }
  return null
}

/** Zerlegt `/de/impressum` in Sprache und Rest (`/impressum`); ohne Sprachpräfix → `null`. */
export function splitLocale(pathname: string): { locale: Locale; rest: string } | null {
  const seg = pathname.split('/')[1]
  if (!isLocale(seg)) return null
  const rest = pathname.slice(seg.length + 1)
  return { locale: seg, rest: rest === '' ? '/' : rest }
}

/**
 * Entsprechung eines Pfads mit Sprachpräfix in der Zielsprache (Sprachumschalter, KONZEPT §2.6):
 * `alternatePath('/de/impressum','en')` → `/en/legal-notice`. Unbekannter Pfad → `null`.
 */
export function alternatePath(pathname: string, locale: Locale): string | null {
  const split = splitLocale(pathname)
  if (!split) return null
  const match = matchRoute(split.rest, split.locale)
  if (!match) return null
  return localizedPath(match.route.id, locale, match.params)
}

/** Fester Alias (`/en/imprint`) → kanonischer Pfad; sonst `null`. */
export function aliasTarget(pathname: string): string | null {
  const alias = aliases.find((a) => a.path === pathname)
  return alias ? localizedPath(alias.routeId, alias.locale) : null
}

/**
 * Muster für next-intl `pathnames`: Parameter-Segmente des Registry-Musters werden durch das Segment des Ordners
 * (`key`) ersetzt, z. B. R04 `/shop/[nummer]-[slug]` → `/shop/[product]`.
 */
export function toFolderPattern(pattern: string, key: string): string {
  const keySegs = key.split('/')
  return pattern
    .split('/')
    .map((seg, i) => (seg.includes('[') ? (keySegs[i] ?? seg) : seg))
    .join('/')
}

/**
 * Route zu den Layout-Segmenten unterhalb von `[locale]` (`useSelectedLayoutSegments()`): Die Ordner sind die
 * EN-Pfade (`key`), dynamische Segmente tragen ihren Wert – deshalb genügt der Abgleich mit den EN-Mustern
 * (`['shop','991-vase']` → R04). Kein Segment = Startseite R01. Unbekannt → `null` (z. B. 404).
 */
export function matchSegments(segments: readonly string[]): RouteMatch | null {
  const parts = segments.filter((s) => s !== '' && !s.startsWith('('))
  // Interne Listen-Variante (`shop/variant/page-2`) gehört zur Liste selbst (R02, R03, R05, R12, R15).
  if (parts.length >= 2 && parts[parts.length - 2] === LIST_VARIANT_SEGMENT) {
    const base = parts.slice(0, -2)
    const match = matchRoute(base.length === 0 ? '/' : `/${base.join('/')}`, 'en')
    if (match && (LIST_ROUTE_IDS as readonly string[]).includes(match.route.id)) return match
  }
  return matchRoute(parts.length === 0 ? '/' : `/${parts.join('/')}`, 'en')
}

/**
 * Gegenstück einer Route in der anderen Sprache (Sprachumschalter, KONZEPT §2.6): gleiche Route mit gleichen
 * Parametern; Routen mit sprachabhängigem `slug` (Kategorie, Stück) haben ohne Daten kein sicheres Gegenstück →
 * Startseite der Zielsprache. Ohne Route (404) ebenfalls die Startseite.
 */
export function alternateForMatch(match: RouteMatch | null, locale: Locale): string {
  if (!match || 'slug' in match.params) return localizedPath('R01', locale)
  return localizedPath(match.route.id, locale, match.params)
}

/**
 * Beispiel-Parameter live geschalteter Routen mit Parametern – für Querschnittsprüfungen (Barrierefreiheit, Datenschutz,
 * SEO, Tempo, Verbotsmuster), die jede `live`-Route aufrufen. R03 aus dem Grund-Seed (Kategorien, SEED-SPEC §3), R04
 * aus dem Beispielbestand (S01 Nr. 901, `pnpm seed` bzw. `--seed=all` in allen Test-Umgebungen).
 */
export const ROUTE_SAMPLE_PARAMS: Readonly<Record<string, Record<Locale, RouteParams>>> = {
  R03: { de: { slug: 'keramik' }, en: { slug: 'ceramics' } },
  R04: {
    de: { nummer: '901', slug: 'schale-langohr-wuschel' },
    en: { nummer: '901', slug: 'bowl-long-ears-fluff' },
  },
}

/**
 * Hat die Route einen Beispielpfad für Querschnittsprüfungen? Routen mit Kunden-Token (R08, R09) haben keinen – ihre
 * Header, Barrierefreiheit und Verbotsmuster prüfen eigene Suiten mit Fixture-Bestellungen (P4.17, P4.23).
 */
export function hasSamplePath(route: RouteEntry): boolean {
  if (!route.paths) return false
  return !Object.values(route.paths).some((p) => p.includes('[')) || !!ROUTE_SAMPLE_PARAMS[route.id]
}

/** Pfad einer Route für Querschnittsprüfungen: ohne Parameter wie `localizedPath`, sonst mit Beispiel-Parametern. */
export function samplePath(id: string, locale: Locale): string {
  return localizedPath(id, locale, ROUTE_SAMPLE_PARAMS[id]?.[locale] ?? {})
}

/** API-Pfade mit Kunden-Token (ARCHITEKTUR §2.5) → Muster für Logs. */
const TOKEN_API_PATHS: readonly [RegExp, string][] = [
  [/^\/api\/checkout\/[^/]+\/state\/?$/, '/api/checkout/[token]/state'],
  [/^\/api\/orders\/[^/]+\/documents\/[^/]+$/, '/api/orders/[token]/documents/[file]'],
  [/^\/api\/privacy-export\/[^/]+$/, '/api/privacy-export/[token]'],
]

/**
 * Pfad für Logs ohne Token (P4.23, R-137, ARCHITEKTUR §8.11): `/de/bestellung/<token>` → `/de/bestellung/[token]`,
 * `/api/orders/<token>/documents/<datei>` → `/api/orders/[token]/documents/[file]`. Query und Fragment entfallen bei
 * Token-Pfaden; andere Pfade bleiben unverändert.
 */
export function normalizeLogPath(value: string): string {
  const cut = value.search(/[?#]/)
  const pathname = cut >= 0 ? value.slice(0, cut) : value
  for (const [re, pattern] of TOKEN_API_PATHS) if (re.test(pathname)) return pattern
  const split = splitLocale(pathname)
  if (!split) return value
  const match = matchRoute(split.rest, split.locale)
  if (!match || !('token' in match.params)) return value
  return `/${split.locale}${match.route.paths![split.locale]}`
}
