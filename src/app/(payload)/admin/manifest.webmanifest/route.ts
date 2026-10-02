import { buildManifest } from '@/admin/pwa/manifest'
import { getEnv } from '@/lib/env'

// Web-App-Manifest der Verwaltung unter `ADMIN_ROUTE/manifest.webmanifest` (PLAN P5.29, ARCHITEKTUR §2.1, §8.4).
// `/admin/manifest.webmanifest` direkt → 404 durch den Proxy (interner Mount-Punkt).

export const dynamic = 'force-dynamic'

export function GET(): Response {
  return new Response(JSON.stringify(buildManifest(getEnv().ADMIN_ROUTE)), {
    headers: {
      'content-type': 'application/manifest+json; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
    },
  })
}
