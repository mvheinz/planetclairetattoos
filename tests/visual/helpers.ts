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

/** Alle Bilder sofort laden und dekodieren – ganzseitige Aufnahmen scrollen nicht, `loading="lazy"` bliebe sonst je
 * nach Abstand zum Bildschirm leer (nicht deterministisch). */
export async function loadAllImages(page: Page) {
  await page.evaluate(async () => {
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('img'))
    for (const img of imgs) img.loading = 'eager'
    await Promise.all(imgs.map((img) => img.decode().catch(() => undefined)))
  })
}

/** Messwerte für Abweichungen zwischen lokalen und CI-Referenzen (Zeile `[VIS-DIAG]` im Log; nur mit `VISUAL_DIAG=1`/CI). */
export async function diag(page: Page, label: string) {
  if (!process.env.VISUAL_DIAG && !process.env.CI) return
  // Als Zeichenkette ausgewertet: tsx fügt in Funktionen sonst `__name` ein (im Browser unbekannt).
  const data = await page.evaluate(`(() => {
    var rect = function (sel) {
      var e = document.querySelector(sel)
      if (!e) return null
      var b = e.getBoundingClientRect()
      return [b.x, b.y + scrollY, b.width, b.height].map(function (n) { return Math.round(n * 10) / 10 })
    }
    return {
      scrollHeight: document.documentElement.scrollHeight,
      hero: rect('[data-home-hero]'),
      aside: rect('[data-home-aside]'),
      koko: rect('[data-slot="chairwoman"]'),
      tour: rect('[data-tour]'),
      stations: rect('[data-home-stations]'),
      footer: rect('[data-site-footer]'),
      fonts: Array.from(document.fonts).map(function (f) { return f.family + '|' + f.weight + '|' + f.style + '|' + f.status }),
      lines: Array.from(document.querySelectorAll('main h1, main h2, main p')).slice(0, 40).map(function (e) {
        return e.tagName + ':' + Math.round(e.getBoundingClientRect().height * 10) / 10
      }),
    }
  })()`)
  console.log(`[VIS-DIAG] ${label} ${JSON.stringify(data)}`)
}
