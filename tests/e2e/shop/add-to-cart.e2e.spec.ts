import type { Page } from '@playwright/test'

import { decodeCartCookie } from '../../../src/lib/commerce/cartCookie'
import { holdAdminSessions, withLoginLock } from '../../helpers/adminSessionLock'
import { serverURL, testUser } from '../../helpers/adminEnv'
import { seedTestUser } from '../../helpers/seedUser'
import { expect, test, testPayload } from '../fixtures'
import { ANCHORS, PUBLISHED, openProduct, pathOf } from './productPage'

// P3.11 „In den Korb“ (KONZEPT §3.4 Nr. 6, §4.2, AK-3-08; DESIGN KO-11, MI-07): mit JavaScript ohne Seitenwechsel,
// veraltete Seite (Stück im Hintergrund per Admin-Endpunkt „offline verkauft“) → „Schon verkauft“, ohne JavaScript
// Formular-POST → 303 zurück auf die Produktseite mit „Liegt schon in deinem Korb“ + „Zum Korb“.

const buy = (page: Page) => page.locator('[data-add-to-cart] button')

test.describe('„In den Korb“ mit JavaScript', () => {
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

  test('AK-3-08 veraltete Seite: im Hintergrund offline verkauft → Klick zeigt „Schon verkauft“, kein Cookie', async ({
    page,
    request,
    context,
    fixtureProducts,
  }) => {
    const { id, itemNumber } = await fixtureProducts.create('keramik', PUBLISHED)
    await openProduct(page, request, await pathOf(itemNumber, 'de'))
    await expect(page.locator('[data-product-page]')).toHaveAttribute('data-status-live', '')
    await expect(buy(page)).toBeEnabled()

    // Stück im Hintergrund über den Admin-Endpunkt verkaufen (die geöffnete Seite bleibt veraltet).
    const release = await holdAdminSessions('shared')
    try {
      await seedTestUser()
      const payload = await testPayload()
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
