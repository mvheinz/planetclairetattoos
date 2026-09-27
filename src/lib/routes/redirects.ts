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

/** Ausgenommen von der Spracherkennung (KONZEPT §2.4): Dateien, Systempfade, R31. */
export function isExcludedPath(pathname: string): boolean {
  if (/^\/(api|_next|nr)(\/|$)/.test(pathname)) return true
  if (pathname === '/sitemap.xml' || pathname === '/robots.txt') return true
  const last = pathname.split('/').pop() ?? ''
  return last.includes('.')
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
