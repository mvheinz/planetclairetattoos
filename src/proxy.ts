import createIntlMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from 'next/server'

import { routing } from '@/i18n/routing'
import { getEnv } from '@/lib/env'
import { decidePublicRoute } from '@/lib/routes/redirects'
import { createNonce, type NonceContext } from '@/lib/security/csp'
import { decideListVariant } from '@/lib/shop/listParams'
import { baseHeaders, contextHeaders, nonceContextForPath } from '@/lib/security/headers'

// Verwaltungspfad (ARCHITEKTUR §8.4, E-93, Spike B-01): Der Ordner `src/app/(payload)/admin/` ist nur interner
// Mount-Punkt. `ADMIN_ROUTE/*` wird intern auf `/admin/*` umgeschrieben; direkte Aufrufe von `/admin` oder `/admin/*`
// ergeben 404 (keine Weiterleitung, KONZEPT §2.4). Der Pfad steht nur hier auf dem Server, nie in ausgelieferten Dateien.

export const INTERNAL_ADMIN_MOUNT = '/admin'

const underPrefix = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`)

export type AdminRouteDecision =
  { kind: 'next' } | { kind: 'not-found' } | { kind: 'rewrite'; pathname: string }

/** Reine Entscheidung (unit-testbar): was passiert mit `pathname` bei gegebenem `adminRoute`? */
export function decideAdminRoute(pathname: string, adminRoute: string): AdminRouteDecision {
  if (adminRoute === INTERNAL_ADMIN_MOUNT) return { kind: 'next' }
  if (underPrefix(pathname, adminRoute)) {
    return { kind: 'rewrite', pathname: INTERNAL_ADMIN_MOUNT + pathname.slice(adminRoute.length) }
  }
  if (underPrefix(pathname, INTERNAL_ADMIN_MOUNT)) return { kind: 'not-found' }
  return { kind: 'next' }
}

const intlMiddleware = createIntlMiddleware(routing)

/** Sprach-Header von next-intl (wie dessen Middleware ihn bei Umschreibungen setzt). */
const INTL_LOCALE_HEADER = 'X-NEXT-INTL-LOCALE'

/** Schlichte 404 des Proxys (Verwaltungs-Ordner, interne Varianten-Pfade, unbekannte Wurzel-Dateien) – ohne Weiterleitung. */
const notFound = () =>
  withBaseHeaders(
    new NextResponse('Not Found', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    }),
  )

/** `www.<apex>` → Apex-Host aus `NEXT_PUBLIC_SITE_URL` (KONZEPT §2.4, Rückfallebene zur Hosting-Konfiguration). */
export function wwwRedirectTarget(
  host: string | null,
  siteUrl: string,
  pathAndQuery: string,
): string | null {
  if (!host) return null
  const site = new URL(siteUrl)
  if (host.toLowerCase() !== `www.${site.host}`.toLowerCase()) return null
  return `${site.origin}${pathAndQuery}`
}

const redirect = (location: string | URL, status: 307 | 308, vary = false) => {
  const res = NextResponse.redirect(location, status)
  if (vary) res.headers.set('vary', 'Accept-Language')
  return withBaseHeaders(res)
}

/** Eigene Antworten des Proxys (Weiterleitung, 404) bekommen die allgemeinen Header (§8.1) hier selbst. */
function withBaseHeaders(res: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(baseHeaders(getEnv().APP_ENV)))
    res.headers.set(key, value)
  return res
}

/**
 * Nonce-Kontext (ARCHITEKTUR §8.1): neue Nonce je Anfrage, CSP auch als Anfrage-Header, damit Next die Nonce beim
 * Rendern an seine Skripte hängt; Antwort-Header überschreiben die statischen Werte aus `next.config.ts`.
 */
function nonceHeaders(context: NonceContext, tokenPage: boolean, request: NextRequest) {
  const env = getEnv()
  const nonce = createNonce()
  const response = contextHeaders(context, {
    appEnv: env.APP_ENV,
    nodeEnv: env.NODE_ENV,
    paymentsDriver: env.PAYMENTS_DRIVER,
    nonce,
    tokenPage,
  })
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('content-security-policy', response['Content-Security-Policy']!)
  requestHeaders.set('x-nonce', nonce)
  return { requestHeaders, response }
}

const applyHeaders = (res: NextResponse, headers: Record<string, string>) => {
  for (const [key, value] of Object.entries(headers)) res.headers.set(key, value)
  return res
}

/** Reihenfolge: www → Verwaltung → Schrägstrich/Sprache/Aliasse → next-intl. Setzt nie ein Cookie (R-130). */
export function proxy(request: NextRequest): NextResponse {
  const env = getEnv()
  const { pathname, search } = request.nextUrl

  const www = wwwRedirectTarget(
    request.headers.get('host'),
    env.NEXT_PUBLIC_SITE_URL,
    pathname + search,
  )
  if (www) return redirect(www, 308)

  const decision = decideAdminRoute(pathname, env.ADMIN_ROUTE)
  if (decision.kind === 'rewrite') {
    const url = request.nextUrl.clone()
    url.pathname = decision.pathname
    const { requestHeaders, response } = nonceHeaders('admin', false, request)
    return applyHeaders(
      NextResponse.rewrite(url, { request: { headers: requestHeaders } }),
      response,
    )
  }
  if (decision.kind === 'not-found') return notFound()

  // Listen-Varianten (§9.1, Spike B-05): interne Pfade sind nie direkt erreichbar.
  const variant = decideListVariant(pathname, search)
  if (variant.kind === 'not-found') return notFound()

  const route = decidePublicRoute(pathname, search, request.headers.get('accept-language'))
  if (route.kind === 'redirect') {
    return redirect(new URL(route.location, request.nextUrl), route.status, route.vary)
  }
  if (route.kind === 'not-found') return notFound()
  if (route.kind === 'pass') return NextResponse.next()

  // Bekannte Listen-Parameter → statische Variante; sichtbare URL bleibt die Query-Form. Öffentliche Listen haben den
  // Header-Kontext `public` (ohne Nonce), die Umschreibung braucht deshalb nur die Sprache für next-intl.
  if (variant.kind === 'rewrite') {
    const url = request.nextUrl.clone()
    url.pathname = variant.pathname
    url.search = ''
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set(INTL_LOCALE_HEADER, variant.pathname.split('/')[1]!)
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } })
  }

  const nonceContext = nonceContextForPath(pathname)
  if (!nonceContext) {
    const res = intlMiddleware(request)
    res.headers.delete('set-cookie')
    return res
  }
  const { requestHeaders, response } = nonceHeaders(
    nonceContext.context,
    nonceContext.tokenPage,
    request,
  )
  const res = intlMiddleware(new NextRequest(request, { headers: requestHeaders }))
  res.headers.delete('set-cookie')
  return applyHeaders(res, response)
}

export const config = {
  // Statische Build-Dateien und die API brauchen den Proxy nicht.
  matcher: ['/((?!_next/static|_next/image|api/|favicon\\.ico).*)'],
}
