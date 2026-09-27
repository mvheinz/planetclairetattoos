import { NextResponse, type NextRequest } from 'next/server'

import { getEnv } from '@/lib/env'

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

export function proxy(request: NextRequest): NextResponse {
  const decision = decideAdminRoute(request.nextUrl.pathname, getEnv().ADMIN_ROUTE)
  if (decision.kind === 'rewrite') {
    const url = request.nextUrl.clone()
    url.pathname = decision.pathname
    return NextResponse.rewrite(url)
  }
  if (decision.kind === 'not-found') {
    return new NextResponse('Not Found', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    })
  }
  return NextResponse.next()
}

export const config = {
  // Statische Build-Dateien und die API brauchen den Proxy nicht.
  matcher: ['/((?!_next/static|_next/image|api/|favicon\\.ico).*)'],
}
