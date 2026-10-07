import type { APIRequestContext, APIResponse } from '@playwright/test'

import { productPath } from '../../../src/lib/shop/format'
import { expect, test, testPayload } from '../fixtures'
import { NO_CACHE, freshPage, refresh } from './fresh'

// P3.7 Produktseite R04: Auflösung, Weiterleitungen, 404-Varianten und Kurzlink R31 (KONZEPT §2.3, §2.4, §3.17;
// DESIGN KO-18). Grundlage: Mini-Beispielbestand – S01 (Nr. 901, `available`, Slugs DE/EN), S09 (909, `archived`),
// S18/S25 (918/925, `draft`). Den echten Anker S08 (`sold`, nicht im Archiv) prüft P8.21; hier ein Fixture-Stück analog
// S08 im Fixture-Block des Projekts (980–999).

const S01_DE = '/de/shop/901-schale-langohr-wuschel'
const S01_EN = '/en/shop/901-bowl-long-ears-fluff'

const get = (request: APIRequestContext, url: string, headers: Record<string, string> = {}) =>
  request.get(url, { maxRedirects: 0, headers: { ...NO_CACHE, ...headers } })

/**
 * Pfad des Weiterleitungsziels. Next 16.3 schickt beim ersten (ISR-)Rendern einer Weiterleitung den `location`-Kopf
 * doppelt mit gleichem Wert (wie in `shop.e2e.spec.ts`) – beide müssen gleich sein.
 */
function locationPath(res: APIResponse): string {
  const values = res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === 'location')
    .map((h) => h.value)
  expect(values.length, 'Location').toBeGreaterThan(0)
  expect(new Set(values).size, values.join(' | ')).toBe(1)
  return new URL(values[0]!, 'http://x').pathname
}

function expectNoCookie(res: APIResponse) {
  expect(
    res.headersArray().filter((h) => h.name.toLowerCase() === 'set-cookie'),
    res.url(),
  ).toEqual([])
}

test.describe('R04 Auflösung und Weiterleitungen', () => {
  test('AK-2-03 nicht kanonische Formen → 308 auf productPath(); kanonisch → 200; kein Set-Cookie', async ({
    request,
  }) => {
    const cases: [string, string][] = [
      ['/de/shop/901', S01_DE], // kein Slug
      ['/de/shop/0901-schale-langohr-wuschel', S01_DE], // andere Auffüllung
      ['/de/shop/901-alter-titel', S01_DE], // alter Slug nach Titeländerung
      ['/en/shop/901-schale-langohr-wuschel', S01_EN], // Slug der anderen Sprache
      ['/de/shop/901-bowl-long-ears-fluff', S01_DE],
      ['/en/shop/901', S01_EN],
    ]
    for (const [from, to] of cases) {
      const res = await get(request, from)
      expect(res.status(), from).toBe(308)
      expect(locationPath(res), from).toBe(to)
      expectNoCookie(res)
    }
    for (const url of [S01_DE, S01_EN]) {
      const res = await get(request, url)
      expect(res.status(), url).toBe(200)
      expectNoCookie(res)
    }
  })

  test('AK-3-04 Seed-Anker S09 (archiviert), S18 und S25 (Entwurf), unbekannt und ohne Nummer → 404 „losgerissen“', async ({
    request,
    page,
  }) => {
    for (const url of [
      '/de/shop/909',
      '/de/shop/909-fliese-reh-im-planetenregen',
      '/de/shop/918-cap-kleiner-planet',
      '/en/shop/925',
      '/de/shop/99999-gibt-es-nicht',
      '/de/shop/ohne-nummer',
    ]) {
      const res = await get(request, url)
      expect(res.status(), url).toBe(404)
      expect(await res.text(), url).toMatch(/<meta name="robots" content="noindex"/)
      expectNoCookie(res)
    }
    await freshPage(page)
    const res = await page.goto('/de/shop/918-cap-kleiner-planet')
    expect(res?.status()).toBe(404)
    await expect(page.locator('h1')).toHaveText('Diese Seite hat sich in den Nebel gezeichnet')
    await expect(page.locator('[data-not-found]')).toHaveAttribute('data-variant', 'lost')
    await expect(page.locator('body')).toHaveAttribute('data-preset', 'lost')
    await expect(page.locator('body')).toHaveAttribute('data-route', 'R28')
    // Das Stück selbst verrät die 404 nicht (Entwurf)
    await expect(page.getByText('Kleiner Planet')).toHaveCount(0)
  })

  test('AK-3-04 Fixture analog S08 (sold, showInArchiveAfterSale = false) → 404-Variante „Zuhause“ mit noindex', async ({
    request,
    page,
    fixtureProducts,
  }) => {
    const { itemNumber } = await fixtureProducts.create('keramik', {
      status: 'sold',
      firstPublishedAt: '2026-09-01T10:00:00.000Z',
      soldAt: '2026-09-20T10:00:00.000Z',
      soldChannel: 'offline',
      offlineSaleNote: 'Flohmarkt',
      showInArchiveAfterSale: false,
    })
    const payload = await testPayload()
    const doc = (
      await payload.find({
        collection: 'products',
        where: { itemNumber: { equals: itemNumber } },
        locale: 'de',
        overrideAccess: true,
        limit: 1,
      })
    ).docs[0]!
    const url = productPath({ itemNumber, slug: doc.slug }, 'de')
    await refresh(request, [url, `/de/shop/${itemNumber}`])

    for (const u of [url, `/de/shop/${itemNumber}`]) {
      const res = await get(request, u)
      expect(res.status(), u).toBe(404)
      expect(await res.text(), u).toMatch(/<meta name="robots" content="noindex"/)
      expectNoCookie(res)
    }

    await freshPage(page)
    const res = await page.goto(url)
    expect(res?.status()).toBe(404)
    const nf = page.locator('[data-not-found]')
    await expect(nf).toHaveAttribute('data-variant', 'home')
    await expect(page.locator('h1')).toHaveText('Dieses Stück ist weitergezogen')
    // Links Shop und Archiv
    const links = nf.locator('nav a')
    await expect(links).toHaveCount(2)
    await expect(links.nth(0)).toHaveAttribute('href', '/de/shop')
    await expect(links.nth(1)).toHaveAttribute('href', '/de/archiv')
    // KO-18: Mini-Preisschild „sold“ am Leinenende, Coco sitzt, kein Weglaufen; Preset `lost`
    await expect(nf.locator('[data-sold-tag]')).toHaveText('sold')
    await expect(nf.locator('[data-lost-coco]')).toHaveCount(0)
    await expect(page.locator('[data-behavior~="lost"]')).toHaveCount(0)
    await expect(page.locator('body')).toHaveAttribute('data-preset', 'lost')
    // Das Nummernfeld gehört nur zur Variante „losgerissen“
    await expect(page.locator('[data-number-form]')).toHaveCount(0)
    // „Vertrag widerrufen“ auch hier (R-011)
    await expect(
      page.locator('[data-site-footer] a', { hasText: 'Vertrag widerrufen' }).first(),
    ).toBeVisible()
  })
})

test.describe('R31 Kurzlink /nr/[nummer]', () => {
  test('AK-2-06 Accept-Language de → DE-Seite, en-US,en;q=0.9 → EN-Seite; Vary, no-store, kein Cookie', async ({
    request,
  }) => {
    const cases: [string | undefined, string][] = [
      ['de', S01_DE],
      ['en-US,en;q=0.9', S01_EN],
      ['fr-FR,en;q=0.5,de;q=0.8', S01_DE],
      ['fr-FR', S01_DE],
    ]
    for (const [lang, to] of cases) {
      for (const nr of ['901', '0901']) {
        const res = await request.get(`/nr/${nr}`, {
          maxRedirects: 0,
          headers: lang ? { 'accept-language': lang } : {},
        })
        expect(res.status(), `${nr} ${lang}`).toBe(307)
        expect(locationPath(res), `${nr} ${lang}`).toBe(to)
        expect(res.headers()['vary']).toMatch(/Accept-Language/i)
        expect(res.headers()['cache-control']).toBe('no-store')
        expectNoCookie(res)
      }
    }
  })

  test('AK-2-06 unbekannte oder nicht öffentliche Nummer → 404 mit 404-Seite (Sprache aus Accept-Language)', async ({
    request,
  }) => {
    for (const nr of ['12345', '909', '918', 'abc', '0']) {
      const res = await request.get(`/nr/${nr}`, {
        maxRedirects: 0,
        headers: { 'accept-language': 'en-GB,en;q=0.9' },
      })
      expect(res.status(), nr).toBe(404)
      expect(res.headers()['vary']).toMatch(/Accept-Language/i)
      expect(res.headers()['cache-control']).toBe('no-store')
      expectNoCookie(res)
      const html = await res.text()
      expect(html, nr).toContain('This page has drawn itself into the fog')
      expect(html, nr).toContain('Withdraw from contract')
    }
  })
})

test.describe('R28 Nummernfeld → R31', () => {
  // Das Ziel folgt Accept-Language (R31), nicht der Seite, auf der das Feld steht: Browser auf Deutsch.
  test.use({ locale: 'de-DE' })

  test('Nummernfeld der 404-Seite zielt auf /nr (ohne JavaScript bedienbar) und führt zum Stück', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === 'webkit', 'ein Browser genügt – reines HTML-Formular')
    await page.goto('/de/gibt-es-nicht')
    const form = page.locator('[data-number-form]')
    await expect(form).toHaveAttribute('action', '/nr')
    await expect(form).toHaveAttribute('method', 'get')
    await form.getByLabel('Ein bestimmtes Stück im Kopf? Nummer eingeben').fill('901')
    await form.getByRole('button', { name: 'Stück suchen' }).click()
    await expect(page).toHaveURL(new RegExp(`${S01_DE}$`))
    await expect(page.locator('h1')).toHaveText('Schale „Langohr & Wuschel“')
  })
})
