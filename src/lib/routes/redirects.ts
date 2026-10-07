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
  /** Unbekannte Datei direkt unter `/` (z. B. `/sw.js`, `/manifest.webmanifest`) → schlichte 404 (P5.29, T-04). */
  | { kind: 'not-found' }

/** Ausgenommen von der Spracherkennung (KONZEPT §2.4): Dateien, Systempfade, R31. */
export function isExcludedPath(pathname: string): boolean {
  if (/^\/(api|_next|nr)(\/|$)/.test(pathname)) return true
  if (pathname === '/sitemap.xml' || pathname === '/robots.txt') return true
  const last = pathname.split('/').pop() ?? ''
  return last.includes('.')
}

/**
 * Dateien, die es direkt unter `/` wirklich gibt: Metadaten-Routen aus `src/app/` (`robots.ts`, `sitemap.ts`, `icon.svg`,
 * `apple-icon.png`, `favicon.ico`) und Dateien aus `public/` (`ai.txt`). Jede andere Datei auf erster Ebene (`/sw.js`, `/manifest.webmanifest`, `/foo.txt`)
 * landete sonst in der ISR-Startseite `[locale]` und endete dort mit 500 („static to dynamic“). `dynamicParams = false`
 * auf der Startseite ist keine Lösung: Nach `revalidateTag('home')` lieferte Next.js 16.3 dann auch `/de` als 404.
 * Ein Unit-Test gleicht die Liste mit `src/app/` und `public/` ab.
 */
export const ROOT_FILES: ReadonlySet<string> = new Set([
  '/robots.txt',
  '/ai.txt',
  '/sitemap.xml',
  '/favicon.ico',
  '/icon.svg',
  '/apple-icon.png',
])

/** Unbekannte Datei auf erster Ebene (Punkt im einzigen Segment, nicht in `ROOT_FILES`)? */
export const isUnknownRootFile = (pathname: string): boolean =>
  /^\/[^/]*\.[^/]*$/.test(pathname) && !ROOT_FILES.has(pathname)

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
  if (isUnknownRootFile(pathname)) return { kind: 'not-found' }
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
