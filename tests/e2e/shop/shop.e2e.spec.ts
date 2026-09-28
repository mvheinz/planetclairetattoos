import type { APIResponse } from '@playwright/test'
import type { Payload } from 'payload'

import type { ProductCategory } from '../../../src/lib/enums'
import { localizedPath } from '../../../src/lib/routes/paths'
import {
  completeProduct,
  createProductFixtures,
  type ProductFixtures,
} from '../../int/helpers/products'
import { holdFixtureRange, type ReleaseLock } from '../../helpers/adminSessionLock'
import { LIST_FIXTURE_RANGE, expect, test, testPayload } from '../fixtures'
import { NO_CACHE, freshPage, holdListData, refresh } from './fresh'

// P3.5 Shop-Übersicht R02 und Kategorie-Seiten R03 (KONZEPT §3.2, §3.3; DESIGN KO-07, KO-08, KO-17; R-030/R-031).
// Grundlage: Mini-Beispielbestand (Grund-Seed + S01, S06 sold/Archiv, S11, S15, S20, S26, S27 reserviert).
// Eigene Stücke im erweiterten E2E-Bereich 975–999 (`LIST_FIXTURE_RANGE`, OFFENE-PUNKTE P3.1/P3.5), nur im Projekt
// `desktop`, nacheinander und mit exklusivem Bereichs-Lock (die Projekt-Blöcke 980–999 anderer Tests warten so lange)
// – andere Projekte prüfen nur lesend.

const PAGINATION = Array.from(
  { length: LIST_FIXTURE_RANGE.to - LIST_FIXTURE_RANGE.from + 1 },
  (_, i) => LIST_FIXTURE_RANGE.from + i,
)
const HIDDEN_SOLD = LIST_FIXTURE_RANGE.from
const OWN = PAGINATION
const day = (d: number) => new Date(Date.UTC(2026, 8, d, 10)).toISOString()

async function removeOwn(payload: Payload) {
  await payload.delete({
    collection: 'products',
    where: { itemNumber: { in: OWN } },
    overrideAccess: true,
    context: { seed: true },
  })
}

let fixtures: ProductFixtures | undefined

async function createPiece(
  payload: Payload,
  nr: number,
  category: ProductCategory,
  extra: Record<string, unknown>,
) {
  const fx = (fixtures ??= await createProductFixtures(payload))
  await payload.create({
    collection: 'products',
    data: { ...completeProduct(category, nr, fx), seed: true, ...extra } as never,
    overrideAccess: true,
    context: { seed: true },
  })
}

/**
 * Ziel einer Weiterleitung. Next 16.3 schickt beim ersten (ISR-)Rendern einer Weiterleitung den `location`-Kopf doppelt
 * mit gleichem Wert (Browser folgen dem, nur abweichende Werte wären ein Fehler) – beide müssen gleich sein.
 */
function locationOf(res: APIResponse): string {
  const values = res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === 'location')
    .map((h) => h.value)
  expect(values.length).toBeGreaterThan(0)
  expect(new Set(values).size, values.join(' | ')).toBe(1)
  return values[0]!
}

const shop = localizedPath('R02', 'de')
const keramik = localizedPath('R03', 'de', { slug: 'keramik' })
const cardNumbers = (page: import('@playwright/test').Page) =>
  page
    .locator('[data-product-card]')
    .evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-item-number'))))

test.describe('Shop R02/R03 – lesend (alle Projekte)', () => {
  holdListData(test, 'shared')
  test.beforeEach(async ({ page }) => freshPage(page))

  test('Aufbau: H1, Einleitung, Chips mit aria-current, Karten, Fußnote und Lieferzeile; Titel', async ({
    page,
  }) => {
    await page.goto(shop)
    await expect(page).toHaveTitle('Shop · Planet Claire')
    await expect(page.locator('h1')).toHaveText('Shop')
    const chips = page.locator('nav [data-chip]')
    await expect(chips.first()).toHaveText('Alle')
    await expect(page.locator('[data-chip="all"]')).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('[data-chip="keramik"]')).not.toHaveAttribute('aria-current', /.*/)
    await expect(page.locator('[data-chip="sonstiges"]')).toHaveCount(0) // showInNavigation = false
    await expect(page.locator('[data-chip="available"]')).toHaveAttribute(
      'href',
      `${shop}?available=1`,
    )
    // Zustände KONZEPT §3.2: reserviert (S27, Nr. 927) mit Hinweis, verkauft (S06, Nr. 906) mit Stempel
    const reserved = page.locator('[data-product-card][data-item-number="927"]')
    await expect(reserved.locator('[data-badge="reserved"]')).toHaveText('reserviert')
    await expect(reserved).toHaveAttribute('aria-label', /, gerade reserviert$/)
    const sold = page.locator('[data-product-card][data-item-number="906"]')
    await expect(sold.locator('[data-sold-stamp]')).toBeVisible()
    await expect(sold).toHaveAttribute('aria-label', /, verkauft$/)
    // R-030/R-031: Sternchen am Preis und seine Auflösung genau einmal auf derselben Seite
    await expect(page.locator('[data-price-tag] [data-money]').first()).toContainText('*')
    await expect(page.locator('#price-footnote')).toHaveCount(1)
    await expect(page.locator('#price-footnote')).toContainText('§ 19 UStG')
    await expect(page.locator('[data-delivery-line]')).toHaveText(
      'Lieferung innerhalb Deutschlands · Abholung in Berlin möglich',
    )
    // AK-3-07: kein „inkl. MwSt“ im Kleinunternehmer-Modus
    expect(await page.content()).not.toMatch(/inkl\.?\s*MwSt/i)
    // Leine: Preset shopString, Coco-Platzhalter am Schnuranfang, Faden-Anker je Karte
    await expect(page.locator('body')).toHaveAttribute('data-preset', 'shopString')
    await expect(page.locator('[data-string-coco]')).toHaveCount(1)
    expect(await page.locator('[data-leash-anchor="tag"]').count()).toBe(
      await page.locator('[data-product-card]').count(),
    )
  })

  test('Kategorie R03: H1 = Name, Einleitung aus categories.intro, Chip aktiv, Titel DE/EN', async ({
    page,
  }) => {
    await page.goto(keramik)
    await expect(page).toHaveTitle('Keramik · Shop · Planet Claire')
    await expect(page.locator('h1')).toHaveText('Keramik')
    await expect(page.locator('header p').first()).toContainText('von Hand geformt')
    await expect(page.locator('[data-chip="keramik"]')).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('[data-chip="all"]')).not.toHaveAttribute('aria-current', /.*/)
    const numbers = await cardNumbers(page)
    expect(numbers).toContain(901)
    expect(numbers).not.toContain(911) // Textil
    await page.goto(localizedPath('R03', 'en', { slug: 'ceramics' }))
    await expect(page).toHaveTitle('Ceramics · Shop · Planet Claire')
    await expect(page.locator('h1')).toHaveText('Ceramics')
  })

  test('AK-3-03 ?available=1: kein Stück mit Status sold; Chip „nur verfügbare“ eingeschaltet', async ({
    page,
  }) => {
    await page.goto(`${shop}?available=1`)
    await expect(page.locator('[data-product-card]').first()).toBeVisible()
    await expect(page.locator('[data-product-card][data-status="sold"]')).toHaveCount(0)
    expect(await cardNumbers(page)).not.toContain(906)
    const toggle = page.locator('[data-chip="available"]')
    await expect(toggle).toHaveAttribute('data-active', '')
    await expect(toggle).toHaveAttribute('href', shop)
    await expect(toggle).toContainText('(eingeschaltet)')
  })

  test('Leerzustand KO-17: Kategorie ohne sichtbare Stücke → „In dieser Ecke …“ + „Alle Stücke“', async ({
    page,
  }) => {
    // `sonstiges` hat im Mini-Bestand keine Stücke (nicht in der Navigation, per URL erreichbar)
    await page.goto(localizedPath('R03', 'de', { slug: 'sonstiges' }))
    const empty = page.locator('[data-empty-state]')
    await expect(empty.locator('h2')).toHaveText('In dieser Ecke ist gerade nichts.')
    await expect(empty.getByRole('link', { name: 'Alle Stücke' })).toHaveAttribute('href', shop)
    await expect(page.locator('[data-product-card]')).toHaveCount(0)
  })

  test('308 auf den Slug der Seitensprache (auch mit Parametern), unbekannter Slug → 404 mit Fußbereich', async ({
    page,
    request,
  }) => {
    const redirect = await request.get('/en/shop/category/keramik', {
      maxRedirects: 0,
      headers: NO_CACHE,
    })
    expect(redirect.status()).toBe(308)
    expect(new URL(locationOf(redirect), 'http://x').pathname).toBe('/en/shop/category/ceramics')
    const withQuery = await request.get('/de/shop/kategorie/ceramics?available=1', {
      maxRedirects: 0,
      headers: NO_CACHE,
    })
    expect(withQuery.status()).toBe(308)
    const target = new URL(locationOf(withQuery), 'http://x')
    expect(target.pathname + target.search).toBe('/de/shop/kategorie/keramik?available=1')

    // Der Browser folgt der Weiterleitung
    await page.goto('/en/shop/category/keramik')
    await expect(page).toHaveURL(/\/en\/shop\/category\/ceramics$/)
    await expect(page.locator('h1')).toHaveText('Ceramics')

    const res = await page.goto('/de/shop/kategorie/gibt-es-nicht')
    expect(res?.status()).toBe(404)
    await expect(page.locator('[data-site-footer]')).toBeVisible()
    await expect(
      page
        .locator('[data-site-footer] [data-withdraw-cta], [data-site-footer] a', {
          hasText: 'Vertrag widerrufen',
        })
        .first(),
    ).toBeVisible()
    expect((await request.get('/de/shop?page=99', { headers: NO_CACHE })).status()).toBe(404)
  })

  test('Tastatur: Chips der Reihe nach erreichbar, Enter öffnet die Kategorie', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === 'webkit', 'Tab-Navigation über Links ist in WebKit standardmäßig aus')
    await page.goto(shop)
    await page.locator('[data-chip="all"]').focus()
    const order: string[] = []
    for (let i = 0; i < 7; i++) {
      order.push(
        (await page.evaluate(() => document.activeElement?.getAttribute('data-chip'))) ?? '',
      )
      await page.keyboard.press('Tab')
    }
    expect(order).toEqual(['all', 'keramik', 'textil', 'cap', 'zeichnung', 'schmuck', 'available'])
    await page.locator('[data-chip="keramik"]').focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(new RegExp(`${keramik}$`))
    await expect(page.locator('[data-chip="keramik"]')).toHaveAttribute('aria-current', 'page')
  })
})

test.describe('Ohne JavaScript', () => {
  test.use({ javaScriptEnabled: false })
  holdListData(test, 'shared')

  test('Filter, „nur verfügbare“ und Karten sind echte Links', async ({ page }) => {
    await freshPage(page)
    await page.goto(shop)
    await page.locator('[data-chip="keramik"]').click()
    await expect(page).toHaveURL(new RegExp(`${keramik}$`))
    // Harte Navigation mit View Transition (§9.8, auch ohne JavaScript): während des Übergangs (250 ms) trifft jeder
    // Klick die Übergangs-Ebene; Playwright bleibt danach an ihr hängen – erst das Ende abwarten.
    await expect
      .poll(() => page.evaluate(() => document.documentElement.matches(':active-view-transition')))
      .toBe(false)
    await page.locator('[data-chip="available"]').click()
    await expect(page).toHaveURL(new RegExp(`${keramik}\\?available=1$`))
    await expect(page.locator('[data-product-card][data-status="sold"]')).toHaveCount(0)
    const card = page.locator('[data-product-card]').first()
    const href = await card.getAttribute('href')
    expect(href).toMatch(/^\/de\/shop\/\d{3,}-/)
  })
})

test.describe('Shop R02/R03 – mit eigenen Stücken (nur desktop)', () => {
  test.describe.configure({ mode: 'serial' })
  let payload: Payload
  let releaseRange: ReleaseLock | undefined

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'ändert Daten – einmal im Projekt desktop')
    releaseRange = await holdFixtureRange('exclusive')
    payload = await testPayload()
    await removeOwn(payload)
    await freshPage(page)
  })

  test.afterEach(async ({}, testInfo) => {
    if (testInfo.project.name !== 'desktop') return
    try {
      await removeOwn(payload)
    } finally {
      await releaseRange?.()
    }
  })

  test('Paginierung mit 25 Stücken: 24 je Seite, „Mehr zeigen“ als Link ?page=2', async ({
    page,
    request,
  }) => {
    for (const [i, nr] of PAGINATION.entries())
      await createPiece(payload, nr, 'zeichnung', {
        status: 'available',
        // neueste zuerst: die Stücke stehen vor dem Beispielbestand
        firstPublishedAt: new Date(Date.UTC(2026, 8, 28, 12, i)).toISOString(),
      })
    await refresh(request, [shop, `${shop}?page=2`])

    await page.goto(shop)
    const first = await cardNumbers(page)
    expect(first).toHaveLength(24)
    const more = page.getByRole('link', { name: 'Mehr zeigen' })
    await expect(more).toHaveAttribute('href', `${shop}?page=2`)
    await more.click()
    await expect(page).toHaveURL(new RegExp(`${shop}\\?page=2$`))
    await expect(page.locator('[data-product-card]').first()).toBeVisible()
    const second = await cardNumbers(page)
    expect(second.length).toBeGreaterThan(0)
    for (const nr of PAGINATION) expect([...first, ...second], `Nr. ${nr}`).toContain(nr)
    expect(first.filter((n) => second.includes(n))).toEqual([])
    // Die letzte Seite braucht keinen weiteren Link
    if (first.length + second.length === (await countPublic(payload)))
      await expect(page.getByRole('link', { name: 'Mehr zeigen' })).toHaveCount(0)
  })

  test('AK-3-04 sold mit showInArchiveAfterSale = false erscheint auf keiner Liste', async ({
    page,
    request,
  }) => {
    await createPiece(payload, HIDDEN_SOLD, 'keramik', {
      status: 'sold',
      firstPublishedAt: day(1),
      soldAt: day(20),
      soldChannel: 'offline',
      offlineSaleNote: 'Flohmarkt',
      showInArchiveAfterSale: false,
    })
    const urls = [shop, `${shop}?available=1`, keramik, `${keramik}?available=1`]
    await refresh(request, urls)
    for (const url of urls) {
      await page.goto(url)
      await expect(page.locator('[data-product-card]').first(), url).toBeVisible()
      expect(await cardNumbers(page), url).not.toContain(HIDDEN_SOLD)
    }
  })

  test('Shop pausiert: closedMessage über dem Raster, die Stücke bleiben sichtbar (KONZEPT §3.2)', async ({
    page,
    request,
  }) => {
    const before = await payload.findGlobal({ slug: 'settings', overrideAccess: true, depth: 0 })
    const message = 'Ich bin im Urlaub – ab dem 15. geht es weiter.'
    try {
      await payload.updateGlobal({
        slug: 'settings',
        data: { shop: { ...before.shop, isOpen: false, closedMessage: message } } as never,
        overrideAccess: true,
        locale: 'de',
        context: { seed: true },
      })
      await refresh(request, [shop, keramik])
      await page.goto(shop)
      const notice = page.locator('[data-shop-closed]')
      await expect(notice).toHaveText(message)
      await expect(page.locator('[data-product-card]').first()).toBeVisible()
      // DOM-Reihenfolge: Hinweis vor dem Raster
      const order = await page.evaluate(() => {
        const n = document.querySelector('[data-shop-closed]')!
        const g = document.querySelector('[data-product-card]')!
        return n.compareDocumentPosition(g) & Node.DOCUMENT_POSITION_FOLLOWING
      })
      expect(order).toBeTruthy()
      await page.goto(keramik)
      await expect(page.locator('[data-shop-closed]')).toHaveText(message)
    } finally {
      await payload.updateGlobal({
        slug: 'settings',
        data: { shop: before.shop } as never,
        overrideAccess: true,
        locale: 'de',
        context: { seed: true },
      })
      await refresh(request, [shop, keramik])
    }
  })
})

async function countPublic(payload: Payload): Promise<number> {
  const res = await payload.count({
    collection: 'products',
    where: {
      or: [
        { status: { in: ['available', 'reserved'] } },
        {
          and: [{ status: { equals: 'sold' } }, { showInArchiveAfterSale: { equals: true } }],
        },
      ],
    },
    overrideAccess: true,
  })
  return res.totalDocs
}
