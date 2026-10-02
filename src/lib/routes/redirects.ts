// Sprach- und Pfad-Weiterleitungen der öffentlichen Website (ARCHITEKTUR §2.3, KONZEPT §2.4) als reine Entscheidung.
// Die Kurz-URLs (R-010) laufen statisch über `next.config.ts` `redirects()` vor dem Proxy.
import { pickLocale } from '../../i18n/pickLocale'
import { aliasTarget, localizedPath, matchRoute, splitLocale } from './paths'
import { LOCALES, type Locale } from './registry'

export type PublicRouteDecision =
  /** Weiterleitung; `vary` = Antwort hängt von `Accept-Language` ab. */
  | { kind: 'redirect'; status: 307 | 308; location: string; vary?: boolean }
  /** Seite mit Sprachpräfix → next-intl (interne Umschreibung auf den Ordnernamen). */
  | { kind: 'intl' }
  /** Nicht Sache der Sprachlogik (Dateien, /nr, Sitemap, robots.txt). */
  | { kind: 'pass' }
  /** Datei-Pfad, den es nicht gibt (z. B. `/manifest.webmanifest`, `/sw.js`) → schlichte 404 des Proxys. */
  | { kind: 'not-found' }

/** Ausgenommen von der Spracherkennung (KONZEPT §2.4): Dateien, Systempfade, R31. */
export function isExcludedPath(pathname: string): boolean {
  if (/^\/(api|_next|nr)(\/|$)/.test(pathname)) return true
  if (pathname === '/sitemap.xml' || pathname === '/robots.txt') return true
  const last = pathname.split('/').pop() ?? ''
  return last.includes('.')
}

/** Echte Dateien direkt unter `/` (Next-Metadaten-Routen in `src/app/`; `favicon.ico` schließt der Matcher aus). */
export const ROOT_FILES: ReadonlySet<string> = new Set([
  '/favicon.ico',
  '/icon.svg',
  '/apple-icon.png',
  '/robots.txt',
  '/sitemap.xml',
])

/** Erste Pfadsegmente, unter denen Dateien liegen dürfen: Systempfade und die Ordner in `public/`. */
export const FILE_PREFIXES: ReadonlySet<string> = new Set([
  'api',
  '_next',
  'nr',
  'art',
  'legal',
  'og',
])

/**
 * Datei-Pfad, den es sicher nicht gibt (P5.29, T-04): Ohne diese Prüfung fiele z. B. `/manifest.webmanifest` in das
 * dynamische Wurzel-Segment `[locale]` (statisch nur `de`/`en`, ISR ohne `dynamicParams = false`, P6.5); dessen
 * `not-found` liest dann Anfrage-Header und Next bricht mit 500 „Page changed from static to dynamic“ ab.
 */
export function isUnknownFilePath(pathname: string): boolean {
  if (!isExcludedPath(pathname)) return false
  if (ROOT_FILES.has(pathname)) return false
  const first = pathname.split('/')[1] ?? ''
  if (FILE_PREFIXES.has(first)) return false
  return !(LOCALES as readonly string[]).includes(first)
}

/**
 * Entscheidet für `pathname` (ohne Query; `search` wird angehängt):
 * 1. abschließender Schrägstrich → 308 ohne;
 * 2. mit Sprachpräfix: Pfad dieser Sprache → next-intl; fester Alias oder Pfad der anderen Sprache → 308;
 * 3. ohne Sprachpräfix: `/` und übrige Pfade → 307 in die erkannte Sprache (übersetzt, falls bekannt), ohne Cookie.
 */
export function decidePublicRoute(
  pathname: string,
  search: string,
  acceptLanguage: string | null | undefined,
): PublicRouteDecision {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return {
      kind: 'redirect',
      status: 308,
      location: (pathname.replace(/\/+$/, '') || '/') + search,
    }
  }
  if (isUnknownFilePath(pathname)) return { kind: 'not-found' }
  if (isExcludedPath(pathname)) return { kind: 'pass' }

  const split = splitLocale(pathname)
  if (split) {
    const { locale, rest } = split
    if (matchRoute(rest, locale)) return { kind: 'intl' }
    const alias = aliasTarget(pathname)
    if (alias) return { kind: 'redirect', status: 308, location: alias + search }
    for (const other of LOCALES.filter((l): l is Locale => l !== locale)) {
      const match = matchRoute(rest, other)
      if (match) {
        return {
          kind: 'redirect',
          status: 308,
          location: localizedPath(match.route.id, locale, match.params) + search,
        }
      }
    }
    return { kind: 'intl' }
  }

  const locale = pickLocale(acceptLanguage)
  if (pathname === '/')
    return { kind: 'redirect', status: 307, location: `/${locale}${search}`, vary: true }
  const match = matchRoute(pathname, 'de') ?? matchRoute(pathname, 'en')
  const location = match
    ? localizedPath(match.route.id, locale, match.params)
    : `/${locale}${pathname}`
  return { kind: 'redirect', status: 307, location: location + search, vary: true }
}
