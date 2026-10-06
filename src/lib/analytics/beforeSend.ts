// Filter für Vercel Web Analytics (PLAN P10.11, R-132, R-210 Nr. 10): `beforeSend` verwirft Kasse, Warenkorb, Danke-Seite,
// Bestellstatus, Widerrufs-Schritte und Verwaltungs-/API-Pfade und entfernt alle Query-Parameter und Fragmente. Keine
// Custom Events. Reine Funktion ohne Importe (läuft im Browser); die Pfadliste wird im Unit-Test gegen die Routen-Registry
// geprüft (R06–R09, R26 in beiden Sprachen).

export type AnalyticsEvent = { type: 'pageview' | 'event'; url: string }

/** Erste Pfadsegmente (ohne Sprachpräfix), deren Seiten nie gezählt werden. */
export const ANALYTICS_BLOCKED_PREFIXES = [
  '/warenkorb',
  '/cart',
  '/kasse',
  '/checkout',
  '/danke',
  '/thank-you',
  '/bestellung',
  '/order',
  '/vertrag-widerrufen',
  '/widerruf',
  '/withdraw-from-contract',
  '/withdraw',
  '/nr',
  '/qa',
  '/admin',
  '/api',
] as const

/** Pfad ohne `/en`-Präfix. */
const withoutLocale = (pathname: string): string =>
  pathname.replace(/^\/(de|en)(?=\/|$)/, '') || '/'

export function isBlockedPath(pathname: string): boolean {
  const p = withoutLocale(pathname).toLowerCase()
  return ANALYTICS_BLOCKED_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`))
}

export function analyticsBeforeSend<E extends AnalyticsEvent>(event: E): E | null {
  if (event.type !== 'pageview') return null // keine Custom Events
  let url: URL
  try {
    url = new URL(event.url)
  } catch {
    return null
  }
  if (isBlockedPath(url.pathname)) return null
  return { ...event, url: `${url.origin}${url.pathname}` }
}
