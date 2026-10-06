import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { test as base, expect, type Page } from '@playwright/test'

import {
  externalReferences,
  forbiddenStrings,
  hasBanner,
} from '../../scripts/preview-export/portable'
import { localizedPath } from '../../src/lib/routes/paths'

// P10.20 Portabilitätstest (E-98, R-182, ARCHITEKTUR §14.10, KONZEPT §12.7): Die Datei funktioniert auf einem anderen
// Rechner. Der Test kopiert NUR `planet-claire-vorschau.html` in ein frisches Temp-Verzeichnis außerhalb des Repos,
// öffnet sie dort per `file://` in einem neuen Browser-Kontext (offline, andere Zeitzone und Sprache als der Build:
// `America/New_York`, `en-US`) und prüft Startseite, Shop, Produktseite, Kasse, Widerruf, Tattoo und eine
// Verwaltungsansicht. Chromium: alles; WebKit (Safari-Engine): Startseite, Shop, Produktseite. Läuft auch gegen das
// heruntergeladene Release-Asset (`release.yml`, Job `verify-asset`: Datei liegt dann in `dist/`).

const SOURCE = path.resolve(process.env.PREVIEW_FILE ?? 'dist/planet-claire-vorschau.html')
const FONT_FAMILIES = ['spectral', 'spectralItalic', 'bricolage', 'plexMono']
const PRODUCT = '/de/shop/901-schale-langohr-wuschel'
const SIZE_LIMIT = 40_000_000

interface PvRoute {
  route: string
  lang: 'de' | 'en'
  group: string
  built: boolean
}

let dir = ''
let file = ''

base.beforeAll(() => {
  if (!existsSync(SOURCE))
    throw new Error(`${SOURCE} fehlt – erst \`pnpm preview:export\` ausführen.`)
  // Frisches Verzeichnis außerhalb des Repos; nur die eine Datei wird kopiert (kein Bericht, keine Bilder, keine Schriften).
  dir = mkdtempSync(path.join(tmpdir(), 'pc-vorschau-'))
  file = path.join(dir, 'planet-claire-vorschau.html')
  copyFileSync(SOURCE, file)
})
base.afterAll(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
})

interface Watch {
  requests: string[]
  errors: string[]
}

const test = base.extend<{ watch: Watch; portable: Page }>({
  watch: async ({}, provide) => provide({ requests: [], errors: [] }),
  portable: async ({ browser, browserName, watch }, provide) => {
    const url = pathToFileURL(file).href
    const context = await browser.newContext({
      // WebKit (Linux) bricht `file://` im Offline-Modus mit einem internen Fehler ab; dort sperrt die Route unten jede
      // Anfrage außer der Datei selbst – „0 Anfragen“ gilt in beiden Browsern.
      offline: browserName === 'chromium',
      locale: 'en-US',
      timezoneId: 'America/New_York',
      viewport: { width: 1280, height: 900 },
    })
    // Erlaubt ist nur die Datei selbst (und data:/blob:); jede andere Anfrage, auch ein weiteres file:, wird gezählt.
    await context.route('**/*', (route) => {
      const u = route.request().url()
      if (u === url || u.startsWith(`${url}#`) || /^(data|blob):/.test(u)) return route.continue()
      watch.requests.push(u)
      return route.abort()
    })
    const page = await context.newPage()
    page.on('request', (req) => {
      const u = req.url()
      if (!(u === url || u.startsWith(`${url}#`) || /^(data|blob):/.test(u))) watch.requests.push(u)
    })
    page.on('console', (msg) => {
      if (msg.type() === 'error') watch.errors.push(msg.text())
    })
    page.on('pageerror', (err) => watch.errors.push(`pageerror: ${err.message}`))
    await provide(page)
    await context.close()
  },
})

const fileUrl = () => pathToFileURL(file).href

async function open(page: Page, route = '/de'): Promise<void> {
  await page.goto(`${fileUrl()}#${route}`)
  await expect(page.locator('#pv-root h1').first(), `H1 auf ${route}`).toBeVisible()
}

async function go(page: Page, route: string): Promise<void> {
  await page.evaluate((r) => {
    window.location.hash = `#${r}`
  }, route)
  await expect(page.locator('#pv-root h1').first(), `H1 auf ${route}`).toBeVisible()
  await page.waitForFunction(
    (r) => document.querySelector(`template[data-route="${r}"]`) !== null,
    route,
  )
}

/** Alle Bilder der Seite geladen, alle drei Schriftfamilien verfügbar. */
async function expectImagesAndFonts(page: Page, where: string): Promise<void> {
  const images = await page.evaluate(async () => {
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('#pv-root img'))
    for (const img of imgs) {
      img.loading = 'eager'
      await img.decode().catch(() => undefined)
    }
    return imgs.filter((i) => !(i.complete && i.naturalWidth > 0)).length
  })
  expect(images, `${where}: Bilder nicht geladen`).toBe(0)
  const fonts = await page.evaluate(async (families) => {
    await Promise.all(
      families.map((f) => document.fonts.load(`${f.endsWith('Italic') ? 'italic ' : ''}16px ${f}`)),
    )
    return families.filter(
      (f) => !document.fonts.check(`${f.endsWith('Italic') ? 'italic ' : ''}16px ${f}`),
    )
  }, FONT_FAMILIES)
  expect(fonts, `${where}: Schriften`).toEqual([])
}

test.describe('Vorschau-Datei aus einem frischen Verzeichnis (P10.20)', () => {
  test('Datei: Größe, keine Spuren des Build-Rechners, keine externen Verweise, Band (R-182)', async () => {
    const size = statSync(file).size
    expect(size).toBeLessThanOrEqual(SIZE_LIMIT)
    const html = readFileSync(file, 'utf8')
    expect(forbiddenStrings(html, process.cwd())).toEqual([])
    expect(externalReferences(html)).toEqual([])
    expect(hasBanner(html)).toBe(true)
  })

  test('Startseite, Shop und Produktseite: H1, Bilder, Schriften, 0 Anfragen, 0 Konsolenfehler', async ({
    portable: page,
    watch,
  }) => {
    await open(page)
    await expect(page.locator('#pv-banner')).toContainText('Interne Vorschau – nicht weitergeben')
    await expectImagesAndFonts(page, '/de')
    for (const route of [localizedPath('R02', 'de'), PRODUCT]) {
      await go(page, route)
      await expectImagesAndFonts(page, route)
    }
    expect(watch.requests).toEqual([])
    expect(watch.errors).toEqual([])
  })

  test('Kasse, Widerruf, Tattoo und eine Verwaltungsansicht; danach kein Cookie, leerer Web-Storage', async ({
    portable: page,
    watch,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Rest des Rundgangs nur mit Chromium (WebKit: Rauchtest)')
    await open(page)
    const all = await page.evaluate(
      () => (window as unknown as { __PV_ROUTES: PvRoute[] }).__PV_ROUTES,
    )
    const builtAdmin = all.find((r) => r.group === 'admin' && r.built && r.lang === 'de')
    expect(builtAdmin, 'eine gebaute Verwaltungsansicht').toBeDefined()

    // Kasse: Bestellknopf öffnet den Vorschau-Dialog (Attrappe)
    await go(page, localizedPath('R07', 'de'))
    await page.getByRole('button', { name: 'Zahlungspflichtig bestellen' }).click()
    await expect(page.locator('#pv-dialog')).toContainText('Vorschau – hier wird nichts gekauft')
    await page.locator('#pv-dialog button').click()

    for (const route of [
      localizedPath('R26', 'de'),
      localizedPath('R11', 'de'),
      builtAdmin!.route,
    ]) {
      await go(page, route)
      await expect(page.locator('#pv-banner')).toBeVisible()
      await expectImagesAndFonts(page, route)
    }
    // Englische Seite aus der englischen Systemsprache heraus
    await go(page, '/en')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')

    expect(await page.evaluate(() => document.cookie)).toBe('')
    expect(
      await page.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)]),
    ).toEqual([])
    expect(watch.requests).toEqual([])
    expect(watch.errors).toEqual([])
  })
})
