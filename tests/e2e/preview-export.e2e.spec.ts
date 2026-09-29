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
const S01 = '/de/shop/901-schale-langohr-wuschel'

/** Öffentliche Stücke des Beispielbestands (SEED-SPEC): verfügbar, reserviert oder verkauft mit Archiv. */
function publicSeedNumbers(): number[] {
  const products = JSON.parse(
    readFileSync(path.resolve('content/seed/data/products.json'), 'utf8'),
  ) as {
    itemNumber: number
    state: { status: string; showInArchiveAfterSale?: boolean }
  }[]
  return products
    .filter(
      (p) =>
        ['available', 'reserved'].includes(p.state.status) ||
        (p.state.status === 'sold' && p.state.showInArchiveAfterSale === true),
    )
    .map((p) => p.itemNumber)
    .sort((a, b) => a - b)
}

/** Zählt `fetch`- und XHR-Aufrufe der Seite (die Vorschau-Laufzeit darf keine absetzen, P3.16). */
async function countNetworkCalls(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __pvNet: string[] }
    w.__pvNet = []
    const f = window.fetch
    window.fetch = (...args: Parameters<typeof fetch>) => {
      w.__pvNet.push(`fetch ${String(args[0])}`)
      return f(...args)
    }
    const open = XMLHttpRequest.prototype.open
    XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, ...args: unknown[]) {
      w.__pvNet.push(`xhr ${String(args[1])}`)
      return (open as (...a: unknown[]) => void).apply(this, args)
    } as typeof XMLHttpRequest.prototype.open
  })
}

const networkCalls = (page: Page) =>
  page.evaluate(() => (window as unknown as { __pvNet?: string[] }).__pvNet ?? [])

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

  test('P3.10 Produktgalerie: Pfeiltaste, Lightbox mit eingebettetem Foto, Esc – ohne Anfragen', async ({
    page,
    watch,
  }) => {
    await open(page, '#/de/shop/901-schale-langohr-wuschel')
    const track = page.locator('#pv-root [data-gallery-track]')
    await expect(page.locator('#pv-root [data-gallery]')).toHaveAttribute('data-gallery-index', '0')
    await track.focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.locator('#pv-root [data-gallery-counter]')).toHaveText('2 / 2')
    await page.locator('#pv-root [data-gallery-slide="0"] a').click()
    const img = page.locator('#pv-root [data-lightbox-img]')
    await expect(img).toBeVisible()
    await expect(img).toHaveAttribute('src', /^blob:/)
    expect(await img.evaluate((i: HTMLImageElement) => i.naturalWidth > 0)).toBe(true)
    await page.keyboard.press('Escape')
    await expect(page.locator('#pv-root dialog[data-lightbox]')).toBeHidden()
    expect(watch.requests).toEqual([])
    expect(watch.errors).toEqual([])
  })

  test('Nr. 7: „In den Korb“, Bestellknopf und Formular (nur wenn gebaut)', async ({ page }) => {
    await open(page)
    const all = await routes(page)
    const builtIds = new Set(all.filter((r) => r.built).map((r) => r.route))
    const shop = localizedPath('R02', 'de')
    const checkout = localizedPath('R07', 'de')
    const commissions = localizedPath('R10', 'de')
    // Ab P3 ist der Shop gebaut – die Prüfung läuft also immer (Produktseite mit „In den Korb“).
    expect(builtIds.has(shop)).toBe(true)
    if (builtIds.has(S01)) {
      await go(page, S01)
      const add = page
        .locator('#pv-root [data-pv-add-to-cart], #pv-root [data-behavior~="add-to-cart"] button')
        .first()
      await expect(add).toBeVisible()
      const count = page.locator('#pv-root [data-behavior~="cart-count"]').first()
      const before = Number((await count.getAttribute('data-count')) ?? '0')
      await add.click()
      await expect(count).toHaveAttribute('data-count', String(before + 1))
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

  test('P4.25 Korb (S01 + S11) und Kasse je Sprache: Positionen, Zahlungsfeld-Platzhalter, Demo-Countdown ab 30:00, Bestellknopf und Formulare öffnen den Vorschau-Dialog – nichts gespeichert', async ({
    page,
    watch,
  }) => {
    await page.clock.install()
    await open(page)
    for (const lang of LOCALES) {
      const cart = localizedPath('R06', lang)
      await go(page, cart)
      const lines = page.locator('#pv-root [data-cart-line]')
      await expect(lines).toHaveCount(2)
      await expect(lines.nth(0)).toContainText('901')
      await expect(lines.nth(1)).toContainText('911')

      const checkout = localizedPath('R07', lang)
      await go(page, checkout)
      await expect(page.locator('#pv-root [data-payment-field="preview"]')).toBeVisible()
      await expect(page.locator('#pv-root [data-payment-field="mock"]')).toHaveCount(0)
      await expect(page.locator('#pv-root [data-overview-item]')).toHaveCount(2)
      const timer = page.locator('#pv-root [data-countdown="full"] [data-countdown-time]')
      await expect(timer).toHaveText('30:00')
      await page.clock.runFor(65_000)
      await expect(timer).toHaveText('28:55')
      const hash = await page.evaluate(() => window.location.hash)
      await page
        .getByRole('button', {
          name: lang === 'de' ? 'Zahlungspflichtig bestellen' : 'Order with obligation to pay',
        })
        .click()
      await expect(page.locator('#pv-dialog')).toContainText(
        lang === 'de'
          ? 'Vorschau – hier wird nichts gekauft'
          : 'Preview – nothing can be bought here',
      )
      await page.locator('#pv-dialog button').click()
      expect(await page.evaluate(() => window.location.hash)).toBe(hash)
    }
    const state = await page.evaluate(() => ({
      cookie: document.cookie,
      local: localStorage.length,
      session: sessionStorage.length,
    }))
    expect(state).toEqual({ cookie: '', local: 0, session: 0 })
    expect(watch.requests).toEqual([])
    expect(watch.errors).toEqual([])
  })

  test('P3.16 Shop im Modus preview: Schild-Schwingen, Galerie/Lightbox, „In den Korb“-Demo – ohne fetch, ohne Anfragen', async ({
    page,
    watch,
  }) => {
    await countNetworkCalls(page)
    // Schwing-Animationen mitzählen: das Fenster (500–1400 ms nach dem Erscheinen) ist kurz und kann vor dem ersten
    // Abfragen schon vorbei sein – deshalb `animate` auf Schildern protokollieren statt `getAnimations()` abzufragen.
    await page.addInitScript(() => {
      const w = window as unknown as { __pvSwings: number }
      w.__pvSwings = 0
      const orig = Element.prototype.animate
      Element.prototype.animate = function (
        this: Element,
        ...args: Parameters<Element['animate']>
      ) {
        if (this.matches('[data-price-tag-swing]')) w.__pvSwings++
        return orig.apply(this, args)
      }
    })
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await open(page, `#${localizedPath('R02', 'de')}`)
    // MI-02: Preisschilder schwingen beim Erscheinen (IntersectionObserver, Web Animations API). Auf dem Desktop liegt
    // die erste Kartenreihe unter dem Vorschau-Banner knapp unterhalb des Bildschirms – hinscrollen.
    await page.locator('#pv-root [data-price-tag-swing]').first().scrollIntoViewIfNeeded()
    await page.waitForFunction(
      () => (window as unknown as { __pvSwings: number }).__pvSwings > 0,
      undefined,
      { timeout: 10_000 },
    )
    // Galerie und Lightbox auf der Produktseite (S01, zwei Fotos).
    await go(page, S01)
    await page.locator('#pv-root [data-gallery-track]').focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.locator('#pv-root [data-gallery-counter]')).toHaveText('2 / 2')
    await page.locator('#pv-root [data-gallery-slide="1"] a').click()
    await expect(page.locator('#pv-root [data-lightbox-img]')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('#pv-root dialog[data-lightbox]')).toBeHidden()
    // „In den Korb“: Korb-Anzeige zählt nur im Speicher hoch, Hinweis der Vorschau erscheint.
    const count = page.locator('#pv-root [data-behavior~="cart-count"]').first()
    const before = Number((await count.getAttribute('data-count')) ?? '0')
    await page.locator('#pv-root [data-behavior~="add-to-cart"] button').first().click()
    await expect(count).toHaveAttribute('data-count', String(before + 1))
    await expect(page.locator('#pv-cart-note')).toBeVisible()
    expect(await networkCalls(page)).toEqual([])
    expect(watch.requests).toEqual([])
    expect(watch.errors).toEqual([])
    const state = await page.evaluate(() => ({
      cookie: document.cookie,
      local: window.localStorage.length,
      session: window.sessionStorage.length,
    }))
    expect(state).toEqual({ cookie: '', local: 0, session: 0 })
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

    // P3.16 / EK-11: R02–R05 gebaut (DE und EN), Listen-Varianten und alle öffentlichen Seed-Produktseiten enthalten.
    const built = report.routes.filter((r) => r.status === 'ok')
    const builtIds = new Set<string>()
    const products = { de: new Set<number>(), en: new Set<number>() }
    for (const r of built) {
      const split = splitLocale(r.route.split('?')[0]!)
      const match = split ? matchRoute(split.rest, split.locale) : null
      if (!match) continue
      builtIds.add(`${match.route.id}:${r.lang}`)
      if (match.route.id === 'R04') products[r.lang].add(Number(match.params.nummer))
    }
    for (const id of ['R02', 'R03', 'R04', 'R05', 'R06', 'R07', 'R25'])
      for (const lang of LOCALES)
        expect(builtIds.has(`${id}:${lang}`), `${id} ${lang} gebaut`).toBe(true)
    // P4.25 EK-11: Danke- und Statusseiten gebaut, sobald ihre Seed-Anker existieren (P8.4) – vorher „ab P8“ vermerkt.
    for (const id of ['R08', 'R09'])
      for (const lang of LOCALES) {
        if (builtIds.has(`${id}:${lang}`)) continue
        const entry = report.routes.find((r) => {
          const split = splitLocale(r.route)
          return r.lang === lang && split && matchRoute(split.rest, split.locale)?.route.id === id
        })
        expect(entry, `${id} ${lang} im Bericht`).toMatchObject({ status: 'not-built' })
        expect(entry!.note, `${id} ${lang}`).toMatch(/^ab P8/)
      }
    for (const variant of [
      '/de/shop?available=1',
      '/en/shop?available=1',
      '/de/shop/kategorie/keramik?available=1',
      '/en/shop/category/ceramics?available=1',
      '/de/archiv?category=keramik',
      '/en/archive?category=ceramics',
    ])
      expect(listed.has(variant), `Variante ${variant}`).toBe(true)
    const seed = publicSeedNumbers()
    expect(seed.length).toBeGreaterThan(5)
    for (const lang of LOCALES)
      expect(
        [...products[lang]].sort((a, b) => a - b),
        `Seed-Produktseiten ${lang}`,
      ).toEqual(expect.arrayContaining(seed))
  })
})
