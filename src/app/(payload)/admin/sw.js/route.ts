import { SERVICE_WORKER_SOURCE } from '@/admin/pwa/manifest'

// Service Worker der Verwaltung unter `ADMIN_ROUTE/sw.js` (PLAN P5.29, ARCHITEKTUR §8.4): Geltungsbereich
// `ADMIN_ROUTE/` (Standard aus dem Ort der Datei), ohne Daten-Cache, ohne Benachrichtigungen.

export const dynamic = 'force-dynamic'

export function GET(): Response {
  return new Response(SERVICE_WORKER_SOURCE, {
    headers: {
      'content-type': 'text/javascript; charset=utf-8',
      'cache-control': 'no-cache',
      'x-robots-tag': 'noindex, nofollow',
    },
  })
}
