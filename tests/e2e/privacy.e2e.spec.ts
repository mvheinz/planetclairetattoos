import type { Page, Response } from '@playwright/test'

import { pageRoutes, samplePath } from '../../src/lib/routes/paths'
import { LOCALES, ROUTES } from '../../src/lib/routes/registry'
import { serverURL } from '../helpers/adminEnv'
import { expect, test } from './fixtures'

// P2.21 Datenschutz (ARCHITEKTUR §7.4 T-03/T-04, §8.7; RECHT R-130/R-131; KONZEPT EK-04/EK-05; DESIGN AK-DS-04):
// Jede Registry-Route mit Status `live` in DE und EN, in allen drei Projekten, jeweils in einem frischen Browser-Kontext
// (Playwright legt ihn je Test neu an). Ohne Nutzeraktion entsteht kein Endgeräte-Speicher (kein Cookie, kein
// `Set-Cookie`, kein Local/Session Storage, keine IndexedDB, kein Service Worker), und die Seite lädt nur vom eigenen
// Origin (plus `data:`/`blob:`). Die einzige Ausnahme vor dem Warenkorb – `localStorage['pc-motion']` nach Klick auf
// den Schalter „Animationen“ (R-130 a) – prüft `motion-toggle.e2e.spec.ts`.

const ORIGIN = new URL(serverURL).origin
const GOOGLE_FONTS = /(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com)$/

interface Visit {
  name: string
  path: string
  status: number
}

const visits: Visit[] = [
  ...pageRoutes()
    .filter((r) => r.status === 'live')
    .flatMap((r) =>
      LOCALES.map((locale) => ({
        name: `${r.id} ${locale}`,
        path: samplePath(r.id, locale),
        status: 200,
      })),
    ),
  // Fehlerseiten und Weiterleitung (R28–R30) – ebenfalls `live` in der Registry.
  ...LOCALES.flatMap((locale) => [
    { name: `R28 ${locale}`, path: `/${locale}/gibt-es-nicht-${locale}`, status: 404 },
    { name: `R29 ${locale}`, path: `/${locale}/__fehler-test`, status: 500 },
  ]),
  { name: 'R30', path: '/', status: 200 },
  // Kurzlink (P3.7): 307 auf die Produktseite (S01), ebenfalls ohne Cookie.
  { name: 'R31', path: '/nr/901', status: 200 },
]

test('Registry: alle live-Routen sind abgedeckt @privacy', () => {
  const live = ROUTES.filter((r) => r.status === 'live').map((r) => r.id)
  const covered = new Set(visits.map((v) => v.name.split(' ')[0]))
  expect(live.filter((id) => !covered.has(id))).toEqual([])
})

/** Scrollt einmal bis zum Fuß und zurück (IntersectionObserver-gesteuerte Teile wie Linie und Coco laufen an). */
async function exercise(page: Page) {
  await page.evaluate(async () => {
    const step = Math.max(200, Math.floor(window.innerHeight * 0.8))
    for (let y = 0; y <= document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y)
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)))
    }
    window.scrollTo(0, 0)
  })
  await page.waitForLoadState('networkidle')
}

async function deviceStorage(page: Page) {
  return page.evaluate(async () => {
    const idb =
      typeof indexedDB !== 'undefined' && typeof indexedDB.databases === 'function'
        ? (await indexedDB.databases()).map((d) => d.name ?? '?')
        : null
    const sw =
      'serviceWorker' in navigator
        ? (await navigator.serviceWorker.getRegistrations()).map((r) => r.scope)
        : []
    return {
      cookie: document.cookie,
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
      indexedDB: idb,
      serviceWorkers: sw,
      controlled: 'serviceWorker' in navigator && !!navigator.serviceWorker.controller,
    }
  })
}

test.describe('Datenschutz: keine Cookies, kein Speicher, keine Fremd-Requests @privacy', () => {
  for (const visit of visits) {
    test(`T-03/T-04 R-130/R-131 ${visit.name} ${visit.path} @privacy`, async ({
      page,
      context,
      foreignRequests,
    }) => {
      const requests: string[] = []
      context.on('request', (req) => requests.push(req.url()))
      const setCookies: Promise<{ url: string; value: string | null }>[] = []
      const onResponse = (res: Response) =>
        setCookies.push(res.headerValue('set-cookie').then((value) => ({ url: res.url(), value })))
      context.on('response', onResponse)

      const response = await page.goto(visit.path)
      expect(response?.status(), 'Statuscode').toBe(visit.status)
      await page.waitForLoadState('networkidle')
      await exercise(page)

      // T-04/R-130/EK-04: kein Endgeräte-Speicher ohne Nutzeraktion.
      expect(await context.cookies(), 'Cookies').toEqual([])
      const storage = await deviceStorage(page)
      expect(storage).toEqual({
        cookie: '',
        local: [],
        session: [],
        indexedDB: storage.indexedDB === null ? null : [],
        serviceWorkers: [],
        controlled: false,
      })
      if (storage.indexedDB === null)
        test.info().annotations.push({
          type: 'hinweis',
          description: 'indexedDB.databases() fehlt in diesem Browser – IndexedDB nicht auflistbar',
        })
      context.off('response', onResponse)
      const withCookie = (await Promise.all(setCookies)).filter((c) => c.value !== null)
      expect(withCookie, 'Set-Cookie').toEqual([])

      // T-03/R-131/EK-05: nur eigener Origin, `data:` und `blob:`.
      expect(requests.length).toBeGreaterThan(0)
      const foreign = requests.filter((url) => {
        if (url.startsWith('data:') || url.startsWith('blob:')) return false
        return new URL(url).origin !== ORIGIN
      })
      expect(foreign, 'Fremd-Requests').toEqual([])
      expect(foreignRequests, 'blockierte Fremd-Requests').toEqual([])
      // AK-DS-04: nie Google Fonts.
      expect(
        requests.filter((url) => /^https?:/.test(url) && GOOGLE_FONTS.test(new URL(url).hostname)),
      ).toEqual([])
    })
  }
})
