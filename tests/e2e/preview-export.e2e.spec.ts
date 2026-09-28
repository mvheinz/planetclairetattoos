import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { test as base, expect, type Page } from '@playwright/test'

import { PreviewReportSchema } from '../../scripts/preview-export/report'
import { localizedPath, matchRoute, splitLocale } from '../../src/lib/routes/paths'
import { LOCALES, ROUTES } from '../../src/lib/routes/registry'

// Abnahmetest der Vorschau-Datei (T-13, EK-11, AK-12-01; KONZEPT §12.7 Nr. 1–9, ARCHITEKTUR §14.10). Läuft offline gegen
// `file://…/dist/planet-claire-vorschau.html` (`pnpm test:preview-export`, Konfiguration `playwright.preview.config.ts`).

const FILE = path.resolve('dist/planet-claire-vorschau.html')
const REPORT = path.resolve('dist/planet-claire-vorschau.report.json')
const URL_BASE = pathToFileURL(FILE).href
const FONT_FAMILIES = ['mansalva', 'bricolage', 'plexMono']
const NOT_INCLUDED = '/vorschau/nicht-enthalten'

interface PvRoute {
  route: string
  lang: 'de' | 'en'
  title: string
  group: string
  built: boolean
}

interface Watch {
  requests: string[]
  errors: string[]
}

const test = base.extend<{ watch: Watch }>({
  watch: async ({ context, page }, provide) => {
    const watch: Watch = { requests: [], errors: [] }
    await context.route('**/*', (route) => {
      const url = route.request().url()
      if (/^(file|data|blob):/.test(url)) return route.continue()
      watch.requests.push(url)
      return route.abort()
    })
    page.on('request', (req) => {
      if (!/^(file|data|blob):/.test(req.url())) watch.requests.push(req.url())
    })
    page.on('console', (msg) => {
      if (msg.type() === 'error') watch.errors.push(msg.text())
    })
    page.on('pageerror', (err) => watch.errors.push(`pageerror: ${err.message}`))
    await provide(watch)
  },
})

test.beforeAll(() => {
  if (!existsSync(FILE)) throw new Error(`${FILE} fehlt – erst \`pnpm preview:export\` ausführen.`)
})

async function open(page: Page, hash = '#/de'): Promise<void> {
  await page.goto(`${URL_BASE}${hash}`)
  await expect(page.locator('#pv-root h1').first()).toBeVisible()
}

async function go(page: Page, route: string): Promise<void> {
  await page.evaluate((r) => {
    window.location.hash = `#${r}`
  }, route)
  await expect(page.locator('#pv-root h1').first()).toBeVisible()
  await page.waitForFunction(
    (r) => document.querySelector(`template[data-route="${r}"]`) !== null,
    route,
  )
}

async function routes(page: Page): Promise<PvRoute[]> {
  return page.evaluate(() => (window as unknown as { __PV_ROUTES: PvRoute[] }).__PV_ROUTES)
}

/** Gezeichneter Anteil der Tuschelinie aus dem DOM (sichtbare Segmente, aktives Segment anteilig). */
async function leashDrawn(page: Page): Promise<number> {
  return page.evaluate(() => {
    let drawn = 0
    for (const seg of Array.from(document.querySelectorAll<SVGSVGElement>('[data-leash-seg]'))) {
      if (seg.style.visibility === 'hidden') continue
      const reveal = seg.querySelector<SVGPathElement>('mask path')
      const offset = reveal ? parseFloat(reveal.style.strokeDashoffset || '0') : 0
      const length = reveal ? parseFloat(reveal.style.strokeDasharray || '0') : 0
      drawn += length > 0 ? 1 - offset / length : 1
    }
    return drawn
  })
}

async function cocoTransform(page: Page): Promise<string> {
  return page.evaluate(
    () => document.querySelector<HTMLElement>('[data-leash-coco]')?.style.transform ?? '',
  )
}

test.describe('Vorschau-Datei (KONZEPT §12.7)', () => {
  test('T-13 Nr. 1–4: jede Route mit H1, Banner, „Vertrag widerrufen“, Bildern, Schriften und gültigen Links; 0 Anfragen, 0 Fehler', async ({
    page,
    watch,
  }) => {
    await open(page)
    const all = await routes(page)
    const built = all.filter((r) => r.built)
    const known = new Set(built.map((r) => r.route))
    expect(built.length).toBeGreaterThan(10)
    for (const r of built) {
      // Zusatzseiten (ohne Sprachpräfix) erscheinen in der Sprache der zuletzt besuchten Seite.
      if (!/^\/(de|en)(\/|$|\?)/.test(r.route)) await go(page, `/${r.lang}`)
      await go(page, r.route)
      await expect(page.locator('html')).toHaveAttribute('lang', r.lang)
      // Nr. 1: H1, Banner, Fußbereich mit „Vertrag widerrufen“ (Link auf R26 der Sprache).
      await expect(page.locator('#pv-banner')).toBeVisible()
      await expect(page.locator('#pv-banner')).toContainText(
        r.lang === 'de'
          ? 'Interne Vorschau – nicht weitergeben'
          : 'Internal preview – do not share',
      )
      const withdraw = localizedPath('R26', r.lang)
      await expect(
        page.locator(`#pv-root footer a[href="#${withdraw}"]`).first(),
        `${r.route}: Fuß mit „Vertrag widerrufen“`,
      ).toBeAttached()
      // Nr. 3: alle Bilder geladen (lazy → hier sofort laden), alle drei Schriften geladen.
      const images = await page.evaluate(async () => {
        const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('#pv-root img'))
        for (const img of imgs) {
          img.loading = 'eager'
          await img.decode().catch(() => undefined)
        }
        return imgs.map((i) => ({ ok: i.complete && i.naturalWidth > 0, id: i.dataset.pvSrc }))
      })
      expect(
        images.filter((i) => !i.ok),
        `${r.route}: Bilder`,
      ).toEqual([])
      const fonts = await page.evaluate(async (families) => {
        await Promise.all(families.map((f) => document.fonts.load(`16px ${f}`)))
        return families.map((f) => ({ f, ok: document.fonts.check(`16px ${f}`) }))
      }, FONT_FAMILIES)
      expect(
        fonts.filter((x) => !x.ok),
        `${r.route}: Schriften`,
      ).toEqual([])
      // Nr. 4: jeder interne Link zeigt auf eine Route aus __PV_ROUTES oder auf „nicht enthalten“.
      const hrefs = await page.$$eval('#pv-root a[href^="#"]', (as) =>
        as.map((a) => a.getAttribute('href')!),
      )
      for (const href of hrefs) {
        const target = href.slice(1).split('#')[0]!
        expect(
          target === NOT_INCLUDED || known.has(target),
          `${r.route}: Link ${href} ohne Ziel in __PV_ROUTES`,
        ).toBe(true)
      }
    }
    // Nr. 2: keine Anfrage außer file:/data:/blob:, keine Konsolenfehler.
    expect(watch.requests).toEqual([])
    expect(watch.errors).toEqual([])
  })

  test('Kopf: CSP-Meta und robots noindex; Laufzeit ohne Netz', async ({ page, watch }) => {
    await open(page)
    const csp = await page.getAttribute('meta[http-equiv="Content-Security-Policy"]', 'content')
    expect(csp).toContain("default-src 'none'")
    expect(csp).toContain("connect-src 'none'")
    expect(csp).toContain("form-action 'none'")
    expect(await page.getAttribute('meta[name="robots"]', 'content')).toBe('noindex, nofollow')
    expect(watch.requests).toEqual([])
  })

  test('Nr. 5: Startseite – die Linie zeichnet beim Scrollen weiter, Coco bewegt sich', async ({
    page,
    watch,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await open(page, '#/de')
    await expect(page.locator('[data-leash-seg]').first()).toBeAttached()
    await page.waitForTimeout(800)
    const before = await leashDrawn(page)
    const cocoBefore = await cocoTransform(page)
    await page.evaluate(() =>
      window.scrollTo(0, (document.documentElement.scrollHeight - window.innerHeight) / 2),
    )
    await expect.poll(() => leashDrawn(page), { timeout: 10_000 }).toBeGreaterThan(before + 0.5)
    await expect.poll(() => cocoTransform(page), { timeout: 10_000 }).not.toBe(cocoBefore)
    expect(watch.errors).toEqual([])
  })

  test('Nr. 5: mit reduzierter Bewegung ist die Linie vollständig und statisch', async ({
    page,
    watch,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await open(page, '#/de')
    const layer = page.locator('[data-leash-layer]')
    await expect(layer).toHaveAttribute('data-leash-drawn', '')
    const total = await page.locator('[data-leash-seg]').count()
    const drawn = await leashDrawn(page)
    expect(drawn).toBeCloseTo(total, 3)
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await page.waitForTimeout(500)
    expect(await leashDrawn(page)).toBeCloseTo(drawn, 3)
    expect(watch.errors).toEqual([])
  })

  test('Nr. 6: Menü öffnet und schließt per Tastatur, Fokus kehrt zurück', async ({ page }) => {
    await open(page, '#/de')
    const trigger = page.locator('#pv-root [aria-controls="menu"]').first()
    await trigger.focus()
    await page.keyboard.press('Enter')
    const menu = page.locator('#pv-root dialog#menu')
    await expect(menu).toHaveAttribute('open', '')
    await page.keyboard.press('Escape')
    await expect(menu).not.toHaveAttribute('open', '')
    await expect(trigger).toBeFocused()
  })

  test('Nr. 7: „In den Korb“, Bestellknopf und Formular (nur wenn gebaut)', async ({ page }) => {
    await open(page)
    const all = await routes(page)
    const builtIds = new Set(all.filter((r) => r.built).map((r) => r.route))
    const shop = localizedPath('R02', 'de')
    const checkout = localizedPath('R07', 'de')
    const commissions = localizedPath('R10', 'de')
    test.skip(
      !builtIds.has(shop) && !builtIds.has(checkout) && !builtIds.has(commissions),
      'Shop, Kasse und Auftragsarbeiten sind noch nicht gebaut – Prüfung ab P3/P4/P7.',
    )
    if (builtIds.has(shop)) {
      await go(page, shop)
      const add = page
        .locator('#pv-root [data-pv-add-to-cart], #pv-root [data-behavior~="add-to-cart"]')
        .first()
      if (await add.count()) {
        const count = page.locator('#pv-root [data-behavior~="cart-count"]').first()
        const before = Number((await count.getAttribute('data-count')) ?? '0')
        await add.click()
        await expect(count).toHaveAttribute('data-count', String(before + 1))
      }
    }
    if (builtIds.has(checkout)) {
      await go(page, checkout)
      await page.getByRole('button', { name: 'Zahlungspflichtig bestellen' }).click()
      await expect(page.locator('#pv-dialog')).toContainText('Vorschau – hier wird nichts gekauft')
      await page.locator('#pv-dialog button').click()
    }
    if (builtIds.has(commissions)) {
      await go(page, commissions)
      const hash = await page.evaluate(() => window.location.hash)
      await page.locator('#pv-root form[data-pv-form] [type="submit"]').first().click()
      await expect(page.locator('#pv-dialog')).toContainText('Vorschau – hier wird nichts gekauft')
      expect(await page.evaluate(() => window.location.hash)).toBe(hash)
    }
  })

  test('Nr. 7: Formular-Absenden öffnet den Vorschau-Dialog und navigiert nicht', async ({
    page,
  }) => {
    await open(page, '#/de')
    // Ein Formular im aktuellen Stand (ab P6/P7 echte Formulare) – hier in die Seite eingefügt, geprüft wird die Laufzeit.
    await page.evaluate(() => {
      const form = document.createElement('form')
      form.setAttribute('data-pv-form', '')
      form.innerHTML = '<button type="submit" id="pv-test-submit">Senden</button>'
      document.querySelector('#pv-root main')!.appendChild(form)
    })
    await page.click('#pv-test-submit')
    await expect(page.locator('#pv-dialog')).toHaveAttribute('open', '')
    await expect(page.locator('#pv-dialog')).toContainText('Vorschau – hier wird nichts gekauft')
    expect(await page.evaluate(() => window.location.hash)).toBe('#/de')
    await page.keyboard.press('Escape')
    await expect(page.locator('#pv-dialog')).not.toHaveAttribute('open', '')
  })

  test('Nr. 8: Sprachumschalter #/de → #/en, Browser-Zurück funktioniert', async ({ page }) => {
    await open(page, '#/de')
    await page.locator('#pv-root footer [data-language-switcher] a[hreflang="en"]').first().click()
    await expect(page).toHaveURL(/#\/en$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.locator('#pv-banner')).toContainText('Internal preview – do not share')
    await page.goBack()
    await expect(page).toHaveURL(/#\/de$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  })

  test('„Alle Seiten“ listet die Gruppen und markiert nicht gebaute Seiten', async ({ page }) => {
    await open(page, '#/de')
    await page.getByRole('button', { name: 'Alle Seiten' }).click()
    const list = page.locator('#pv-all')
    await expect(list).toBeVisible()
    await expect(list).toContainText('Recht')
    await expect(list).toContainText('Verwaltung')
    await expect(list).toContainText('Noch nicht gebaut')
    await list.locator('a[href="#/vorschau/verwaltung"]').click()
    await expect(page.locator('#pv-root h1')).toHaveText('Verwaltung auf dem Handy')
    await expect(page.locator('#pv-root [data-admin-view="login"] img')).toBeVisible()
    await expect(page.locator('#pv-root [data-admin-view="heute"]')).toContainText('kommt in P5')
  })

  test('nach allen Interaktionen: kein Cookie, leerer Web-Storage', async ({ page }) => {
    await open(page, '#/de')
    await page.locator('#pv-root [data-behavior="motion-toggle"]').first().click()
    await page.locator('#pv-root footer [data-language-switcher] a[hreflang="en"]').first().click()
    await page.getByRole('button', { name: 'All pages' }).click()
    await page.keyboard.press('Escape')
    const state = await page.evaluate(() => ({
      cookie: document.cookie,
      local: window.localStorage.length,
      session: window.sessionStorage.length,
    }))
    expect(state).toEqual({ cookie: '', local: 0, session: 0 })
  })

  test('Nr. 9 und Bericht: ≤ 40 MB, gültiger Bericht nennt jede Registry-Route', async () => {
    const size = statSync(FILE).size
    expect(size).toBeLessThanOrEqual(40_000_000)
    const report = PreviewReportSchema.parse(JSON.parse(readFileSync(REPORT, 'utf8')))
    expect(report.sizeBytes).toBe(size)
    expect(report.budget.result).toBe(size > 20_000_000 ? 'warn' : 'ok')
    if (size > 20_000_000) expect(report.warnings.join('\n')).toContain('zu groß für eine Mail')
    const listed = new Set(report.routes.map((r) => r.route))
    // Jede Registry-Seite je Sprache: gebaut (auch mit Parametern) oder als `not-built` (Muster) genannt.
    const covered = new Set<string>()
    for (const r of report.routes) {
      const split = splitLocale(r.route.split('?')[0]!)
      const match = split ? matchRoute(split.rest, split.locale) : null
      if (match) covered.add(`${match.route.id}:${r.lang}`)
    }
    for (const r of ROUTES) {
      if (r.kind !== 'page') continue
      for (const lang of LOCALES)
        expect(covered.has(`${r.id}:${lang}`), `${r.id} ${lang} fehlt im Bericht`).toBe(true)
    }
    expect(listed.has('/de/__404')).toBe(true)
    expect(listed.has('/en/__404')).toBe(true)
  })
})
