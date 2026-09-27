import createIntlMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'

import { routing } from '@/i18n/routing'
import { getEnv } from '@/lib/env'
import { decidePublicRoute } from '@/lib/routes/redirects'
import { xRobotsTag } from '@/lib/seo/robots'

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
  return withRobots(res)
}

/** Eigene Antworten des Proxys (Weiterleitung, 404) bekommen `X-Robots-Tag` hier; alle übrigen über `next.config.ts`. */
function withRobots(res: NextResponse): NextResponse {
  const robots = xRobotsTag(getEnv().APP_ENV)
  if (robots) res.headers.set('x-robots-tag', robots)
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
    return NextResponse.rewrite(url)
  }
  if (decision.kind === 'not-found') {
    return withRobots(
      new NextResponse('Not Found', {
        status: 404,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
      }),
    )
  }

  const route = decidePublicRoute(pathname, search, request.headers.get('accept-language'))
  if (route.kind === 'redirect') {
    return redirect(new URL(route.location, request.nextUrl), route.status, route.vary)
  }
  if (route.kind === 'pass') return NextResponse.next()

  const res = intlMiddleware(request)
  res.headers.delete('set-cookie')
  return res
}

export const config = {
  // Statische Build-Dateien und die API brauchen den Proxy nicht.
  matcher: ['/((?!_next/static|_next/image|api/|favicon\\.ico).*)'],
}
