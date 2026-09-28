import { test, type Locator, type Page } from '@playwright/test'

// Gemeinsame Vorbereitung der visuellen Tests (ARCHITEKTUR §7.6): feste Uhr, fremde Hosts blockiert, Schriften geladen,
// Linie (statisch, reduzierte Bewegung) gezeichnet, DOM ruhig. Masken nur für Inhalte, die vom Server-Datum abhängen.

/** Feste Uhr im Browser (Server-Zeit ist nicht steuerbar – davon abhängige Stellen werden maskiert). */
export const FIXED_TIME = new Date('2026-06-15T10:00:00.000Z')

/** Referenzen nur unter Linux (Schriftwiedergabe der CI-Runner ist maßgeblich). */
export function linuxOnly() {
  test.skip(
    process.platform !== 'linux',
    'Visuelle Referenzen gibt es nur für Linux (ARCHITEKTUR §7.6)',
  )
}

export async function prepare(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.setFixedTime(FIXED_TIME)
  await page.context().route(
    (url) => !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname),
    (route) => route.abort(),
  )
}

/** Wartet auf Schriften, Netzruhe, gezeichnete Linie und ein ruhiges DOM (500 ms ohne Änderung). */
export async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  await page.waitForLoadState('networkidle')
  // Linie (Stufe C, statisch) wird nach dem LCP im Leerlauf gezeichnet.
  const layer = page.locator('[data-leash-layer]')
  if ((await layer.count()) > 0) {
    await layer
      .first()
      .locator('svg path')
      .first()
      .waitFor({ state: 'attached', timeout: 5_000 })
      .catch(() => undefined)
  }
  // Keine benannten Hilfsfunktionen im Browser-Code (tsx fügt sonst `__name` ein).
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let timer = setTimeout(() => {
          observer.disconnect()
          resolve()
        }, 500)
        const observer = new MutationObserver(() => {
          clearTimeout(timer)
          timer = setTimeout(() => {
            observer.disconnect()
            resolve()
          }, 500)
        })
        observer.observe(document.documentElement, {
          subtree: true,
          childList: true,
          attributes: true,
          characterData: true,
        })
      }),
  )
}

/** Copyright-Jahr kommt aus der Server-Uhr (Europe/Berlin) – maskiert, damit der Jahreswechsel kein Bild ändert. */
export const dynamicMasks = (page: Page): Locator[] => [
  page.locator('[data-site-footer] p', { hasText: '©' }),
]
