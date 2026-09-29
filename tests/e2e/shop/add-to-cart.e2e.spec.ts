import type { Page } from '@playwright/test'

import { decodeCartCookie } from '../../../src/lib/commerce/cartCookie'
import {
  holdAdminSessions,
  holdFixtureRange,
  withLoginLock,
  type ReleaseLock,
} from '../../helpers/adminSessionLock'
import { serverURL, testUser } from '../../helpers/adminEnv'
import { seedTestUser } from '../../helpers/seedUser'
import { completeProduct, createProductFixtures } from '../../int/helpers/products'
import { expect, test, testPayload } from '../fixtures'
import { freshPage, holdListData, refresh } from './fresh'
import { ANCHORS, PUBLISHED, openProduct, pathOf } from './productPage'

// P3.11 „In den Korb“ (KONZEPT §3.4 Nr. 6, §4.2, AK-3-08; DESIGN KO-11, MI-07): mit JavaScript ohne Seitenwechsel,
// veraltete Seite (Stück im Hintergrund per Admin-Endpunkt „offline verkauft“) → „Schon verkauft“, ohne JavaScript
// Formular-POST → 303 zurück auf die Produktseite mit „Liegt schon in deinem Korb“ + „Zum Korb“. Dazu der Live-Zustand
// der Karten auf einer veralteten Shop-Seite (`product-status`: Badge „reserviert“, Stempel, zugänglicher Name).

const buy = (page: Page) => page.locator('[data-add-to-cart] button')

test.describe('„In den Korb“ mit JavaScript (S01)', () => {
  // Shop-Pause anderer Tests (exklusiv) nicht mitten im Test erleben.
  holdListData(test, 'shared')

  test('ohne Seitenwechsel: „Liegt schon in deinem Korb“ + „Zum Korb“, Bestätigung, Korb-Anzahl +1; nach Neuladen weiter im Korb (S01)', async ({
    page,
    request,
  }) => {
    await openProduct(page, request, ANCHORS.S01.de)
    await expect(page.locator('[data-product-page]')).toHaveAttribute('data-status-live', '')
    const count = page.locator('[data-site-header] [data-behavior~="cart-count"]').first()
    await expect(count).toHaveAttribute('data-count', '0')
    await page.evaluate(() => {
      ;(window as unknown as { __noReload: boolean }).__noReload = true
    })

    await buy(page).click()
    const inCart = page.locator('[data-buy-area] [data-in-cart]')
    await expect(inCart).toBeVisible()
    await expect(inCart).toContainText('Liegt schon in deinem Korb')
    await expect(inCart.getByRole('link', { name: 'Zum Korb' })).toHaveAttribute(
      'href',
      '/de/warenkorb',
    )
    await expect(page.locator('[data-buy-confirm]')).toHaveText('Liegt im Korb')
    await expect(count).toHaveAttribute('data-count', '1')
    await expect(page.locator('[data-add-to-cart]')).toBeHidden()
    expect(page.url()).toMatch(/\/de\/shop\/901-schale-langohr-wuschel$/)
    expect(
      await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload),
    ).toBe(true)

    await page.reload()
    await expect(page.locator('[data-buy-area] [data-in-cart]')).toBeVisible()
    await expect(page.locator('[data-add-to-cart]')).toBeHidden()
    await expect(count).toHaveAttribute('data-count', '1')
  })
})

test.describe('AK-3-08 veraltete Seite (exklusiv: das Stück wird verkauft)', () => {
  // Exklusiver Bereichs-Lock: Listen- und „Mehr aus …“-Tests anderer Worker sähen den Live-Wechsel auf „sold“ sonst mit.
  const NUMBER: Record<string, number> = { desktop: 977, 'iphone-15': 978, 'pixel-7': 979 }
  let releaseRange: ReleaseLock | undefined
  let own = 977

  const removeOwn = async () =>
    (await testPayload()).delete({
      collection: 'products',
      where: { itemNumber: { equals: own } },
      overrideAccess: true,
      context: { seed: true },
    })

  test.beforeEach(async ({}, testInfo) => {
    own = NUMBER[testInfo.project.name] ?? 977
    releaseRange = await holdFixtureRange('exclusive')
    await removeOwn()
  })

  test.afterEach(async () => {
    try {
      await removeOwn()
    } finally {
      await releaseRange?.()
    }
  })

  test('AK-3-08 veraltete Seite: im Hintergrund offline verkauft → Klick zeigt „Schon verkauft“, kein Cookie', async ({
    page,
    request,
    context,
  }) => {
    const payload = await testPayload()
    const doc = await payload.create({
      collection: 'products',
      data: {
        ...completeProduct('sonstiges', own, await createProductFixtures(payload)),
        seed: true,
        ...PUBLISHED,
      } as never,
      overrideAccess: true,
      context: { seed: true },
    })
    const id = doc.id as number
    await openProduct(page, request, await pathOf(own, 'de'))
    await expect(page.locator('[data-product-page]')).toHaveAttribute('data-status-live', '')
    await expect(buy(page)).toBeEnabled()

    // Stück im Hintergrund über den Admin-Endpunkt verkaufen (die geöffnete Seite bleibt veraltet).
    const release = await holdAdminSessions('shared')
    try {
      await seedTestUser()
      const { token } = await withLoginLock(() =>
        payload.login({ collection: 'users', data: testUser }),
      )
      const res = await request.post(`${serverURL}/api/products/${id}/sell-offline`, {
        headers: { Authorization: `JWT ${token}` },
        data: { note: 'E2E Atelierverkauf', showInArchive: true },
      })
      expect(res.status(), await res.text()).toBe(200)
    } finally {
      await release()
    }

    await buy(page).click()
    await expect(page.locator('[data-buy-area] [data-sold-text]')).toHaveText('Schon verkauft')
    await expect(page.locator('[data-buy-area]')).toHaveAttribute('data-buy-state', 'sold')
    await expect(page.locator('[data-add-to-cart]')).toBeHidden()
    await expect(page.locator('[data-price-tag="pinned"] [data-sold-stamp]')).toBeVisible()
    expect(await context.cookies()).toEqual([])
  })
})

test.describe('„In den Korb“ ohne JavaScript', () => {
  test.use({ javaScriptEnabled: false })
  holdListData(test, 'shared')

  test('Formular-POST → 303 zurück auf die Produktseite, die „Liegt schon in deinem Korb“ + „Zum Korb“ zeigt (S01)', async ({
    page,
    request,
    context,
  }) => {
    await openProduct(page, request, ANCHORS.S01.de)
    await expect(page.locator('[data-buy-area] [data-in-cart]')).toBeHidden()
    const post = page.waitForResponse((r) => r.request().method() === 'POST')
    await buy(page).click()
    const res = await post
    expect(res.status()).toBe(303)
    expect(await res.headerValue('location')).toMatch(
      /\/de\/shop\/901-schale-langohr-wuschel#in-cart$/,
    )
    await page.waitForURL(/#in-cart$/)
    const inCart = page.locator('[data-buy-area] [data-in-cart]')
    await expect(inCart).toBeVisible()
    await expect(inCart).toContainText('Liegt schon in deinem Korb')
    await expect(inCart.getByRole('link', { name: 'Zum Korb' })).toHaveAttribute(
      'href',
      '/de/warenkorb',
    )
    await expect(page.locator('[data-add-to-cart]')).toBeHidden()
    expect((await context.cookies()).map((c) => c.name)).toEqual(['pc_cart'])

    // Zweites Absenden desselben Stücks: kein Duplikat.
    await page.goto(ANCHORS.S01.de)
    await buy(page).click()
    await page.waitForURL(/#in-cart$/)
    const value = (await context.cookies()).find((c) => c.name === 'pc_cart')!.value
    expect(decodeCartCookie(value)!.items).toHaveLength(1)
  })
})

test.describe('Live-Zustand der Karten (veraltete Shop-Seite, nur desktop)', () => {
  const OWN = [975, 976]
  let releaseRange: ReleaseLock | undefined

  const removeOwn = async () =>
    (await testPayload()).delete({
      collection: 'products',
      where: { itemNumber: { in: OWN } },
      overrideAccess: true,
      context: { seed: true },
    })

  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'ändert Daten – einmal im Projekt desktop')
    releaseRange = await holdFixtureRange('exclusive')
    await removeOwn()
  })

  test.afterEach(async ({ request }, testInfo) => {
    if (testInfo.project.name !== 'desktop') return
    try {
      await removeOwn()
      await refresh(request, ['/de/shop'])
    } finally {
      await releaseRange?.()
    }
  })

  test('nach dem Laden: reserviert → Badge und Name, verkauft → Stempel und Name (Server-HTML noch „available“)', async ({
    page,
    request,
  }) => {
    const payload = await testPayload()
    const fx = await createProductFixtures(payload)
    const ids: number[] = []
    for (const [i, nr] of OWN.entries()) {
      const doc = await payload.create({
        collection: 'products',
        data: {
          ...completeProduct('zeichnung', nr, fx),
          seed: true,
          status: 'available',
          firstPublishedAt: new Date(Date.UTC(2026, 8, 28, 12, i)).toISOString(),
        } as never,
        overrideAccess: true,
        context: { seed: true },
      })
      ids.push(doc.id as number)
    }
    await freshPage(page)
    await refresh(request, ['/de/shop'])
    await page.goto('/de/shop')
    const grid = page.locator('[data-behavior~="product-status"]')
    await expect(grid).toHaveAttribute('data-status-live', '')
    const card = (nr: number) => page.locator(`[data-product-card][data-item-number="${nr}"]`)
    await expect(card(975)).toHaveAttribute('data-status', 'available')

    // Im Hintergrund ändern – der Server erfährt davon nichts (anderer Prozess), die Seite bleibt veraltet.
    await payload.update({
      collection: 'products',
      id: ids[0]!,
      data: {
        status: 'reserved',
        reservedUntil: '2026-12-01T10:00:00.000Z',
        reservationRef: 'e2e',
      },
      overrideAccess: true,
      context: { seed: true },
    })
    await payload.update({
      collection: 'products',
      id: ids[1]!,
      data: {
        status: 'sold',
        soldAt: '2026-09-28T13:00:00.000Z',
        soldChannel: 'offline',
        showInArchiveAfterSale: true,
      },
      overrideAccess: true,
      context: { seed: true },
    })
    if (process.env.E2E_SERVER === 'start') {
      const html = await (await request.get('/de/shop')).text()
      expect(html).toMatch(/data-item-number="975" data-status="available"/)
    }

    await page.reload()
    await expect(grid).toHaveAttribute('data-status-live', '')
    await expect(card(975)).toHaveAttribute('data-status', 'reserved')
    await expect(card(975).locator('[data-badge="reserved"]')).toBeVisible()
    await expect(card(975)).toHaveAttribute('aria-label', /, gerade reserviert$/)
    await expect(card(976)).toHaveAttribute('data-status', 'sold')
    await expect(card(976).locator('[data-sold-stamp]')).toBeVisible()
    await expect(card(976)).toHaveAttribute('aria-label', /, verkauft$/)
  })
})
