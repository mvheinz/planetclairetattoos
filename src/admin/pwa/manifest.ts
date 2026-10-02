// Web-App-Manifest und Service Worker der Verwaltung (PLAN P5.29, KONZEPT §7.1 „PWA“, ARCHITEKTUR §8.4): nur unter
// `ADMIN_ROUTE` ausgeliefert (Route-Handler unter `src/app/(payload)/admin/`), nie aus `public/`. Rein (ohne Server-
// Abhängigkeiten), damit Unit-Tests Manifest und Service Worker direkt prüfen.

export const PWA_NAME = 'Planet Claire Werkstatt'
export const PWA_SHORT_NAME = 'Werkstatt'
/** Matte-Grün der Verwaltung (DESIGN §12.6). */
export const PWA_THEME_COLOR = '#2F6B4C'

/** Icons in `src/admin/pwa/` (erzeugt mit `pnpm art:admin-icons`), ausgeliefert unter `ADMIN_ROUTE/pwa/<Datei>`. */
export const PWA_ICON_FILES = ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png'] as const
export type PwaIconFile = (typeof PWA_ICON_FILES)[number]

export const pwaPaths = (adminRoute: string) => ({
  manifest: `${adminRoute}/manifest.webmanifest`,
  serviceWorker: `${adminRoute}/sw.js`,
  scope: `${adminRoute}/`,
  startUrl: `${adminRoute}/heute`,
  icon: (file: PwaIconFile) => `${adminRoute}/pwa/${file}`,
})

export function buildManifest(adminRoute: string) {
  const p = pwaPaths(adminRoute)
  return {
    id: p.startUrl,
    name: PWA_NAME,
    short_name: PWA_SHORT_NAME,
    lang: 'de',
    dir: 'ltr',
    start_url: p.startUrl,
    scope: p.scope,
    display: 'standalone',
    background_color: PWA_THEME_COLOR,
    theme_color: PWA_THEME_COLOR,
    icons: [
      { src: p.icon('icon-192.png'), sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: p.icon('icon-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  }
}

/**
 * Minimaler Service Worker – nur für die Installierbarkeit: kein Zwischenspeichern von Daten, keine Benachrichtigungen
 * (die kommen per Mail). Anfragen gehen unverändert ans Netz (`fetch` ohne `respondWith`).
 */
export const SERVICE_WORKER_SOURCE = `// Planet Claire Werkstatt: Service Worker nur fuer die Installation als App.
// Kein Zwischenspeichern von Daten, keine Benachrichtigungen; Anfragen gehen unveraendert ans Netz.
self.addEventListener('install', () => {
  self.skipWaiting()
})
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})
self.addEventListener('fetch', () => {})
`
