import type { BrowserContext, Page, Response } from '@playwright/test'

import { serverURL } from '../../helpers/adminEnv'
import { watchCsp } from '../csp'
import { expect, test } from '../fixtures'

// Gemeinsame Prüfung der Suite `@privacy` (ARCHITEKTUR §7.4 T-03/T-04, §8.7; RECHT R-130/R-131; KONZEPT EK-04/EK-05):
// Seite in frischem Kontext aufrufen, einmal durchscrollen, dann kein Endgeräte-Speicher (Cookie, `Set-Cookie`, Local/
// Session Storage, IndexedDB, Service Worker), nur Anfragen an den eigenen Origin (plus `data:`/`blob:`), nie Google
// Fonts, keine CSP-Verstöße. Genutzt von `privacy.e2e.spec.ts` (alle Registry-Routen) und `privacy/p4-pages.e2e.spec.ts`.

export const ORIGIN = new URL(serverURL).origin
const GOOGLE_FONTS = /(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com)$/

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

/**
 * Nur `next dev` legt die IndexedDB `__next_debug_channel` an (Kanal der Entwickler-Werkzeuge von Next 16.3, nicht Teil
 * des Produktions-Builds, den die CI prüft – `E2E_SERVER=start`). Gegen den Entwicklungsserver wird genau diese Kennung
 * ausgenommen; gegen `pnpm start` gilt die Liste ohne Ausnahme.
 */
export const DEV_ONLY_IDB: readonly string[] =
  process.env.E2E_SERVER === 'start' ? [] : ['__next_debug_channel']

export async function deviceStorage(page: Page) {
  return page.evaluate(async (devOnly) => {
    const idb =
      typeof indexedDB !== 'undefined' && typeof indexedDB.databases === 'function'
        ? (await indexedDB.databases())
            .map((d) => d.name ?? '?')
            .filter((name) => !devOnly.includes(name))
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
  }, DEV_ONLY_IDB)
}

/** Ruft `path` in einem frischen Kontext auf und prüft Speicher, Cookies, Requests und CSP (T-03/T-04). */
export async function expectPrivate(
  page: Page,
  context: BrowserContext,
  foreignRequests: string[],
  path: string,
  status: number,
) {
  const requests: string[] = []
  context.on('request', (req) => requests.push(req.url()))
  const setCookies: Promise<{ url: string; value: string | null }>[] = []
  const onResponse = (res: Response) =>
    setCookies.push(res.headerValue('set-cookie').then((value) => ({ url: res.url(), value })))
  context.on('response', onResponse)
  const csp = await watchCsp(page)

  const response = await page.goto(path)
  expect(response?.status(), 'Statuscode').toBe(status)
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
  // CSP-Verstöße lassen den Test scheitern.
  expect(await csp(), 'CSP-Verstöße').toEqual([])
}
