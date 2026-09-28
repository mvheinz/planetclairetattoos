// Pfad-Helfer auf Basis der Routen-Registry (ARCHITEKTUR §2.3). Rein, ohne Framework-Importe und ohne Pfad-Aliasse,
// damit Proxy, `next.config.ts`, Tests und Vorschau-Export sie nutzen können.
import { LOCALES, ROUTES, aliases, type Locale, type RouteEntry } from './registry'

export type RouteParams = Record<string, string>

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
