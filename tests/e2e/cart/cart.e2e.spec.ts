import { decodeCartCookie } from '../../../src/lib/commerce/cartCookie'
import { holdShippingRates, type ReleaseLock } from '../../helpers/adminSessionLock'
import { expectNoSeriousViolations } from '../axe'
import { expectCalm } from '../calm'
import { expect, test, testPayload } from '../fixtures'
import { holdListData } from '../shop/fresh'
import { PUBLISHED } from '../shop/productPage'
import { sql } from '@payloadcms/db-postgres'

import { cleanupCheckouts, db, startCheckoutFor } from '../checkout/checkoutHelpers'
import { R06, euro, expectAmount, norm, productByNumber, setCart } from './cartHelpers'

// P4.8 Warenkorb-Seite R06 (KONZEPT §3.6/§4.2, DESIGN KO-13, KO-17): Anzeige, Entfernen, Lieferart, Zustände
// reserviert/verkauft/Preis geändert mit Fixture-Stücken, Seed-Anker S01 + S11 (SEED-SPEC §17), leerer Korb, Shop
// geschlossen, ohne JavaScript. Der Seitenaufruf setzt kein Cookie und reserviert nichts (EK-04); nur POST-Formulare
// ändern etwas. Grund-Seed-Preise geteilt lesen (`holdShippingRates`), Bestand geteilt (`holdListData`); der Test mit
// pausiertem Shop läuft exklusiv.

function holdRates(t: typeof test) {
  let release: ReleaseLock | undefined
  t.beforeEach(async () => {
    release = await holdShippingRates('shared')
  })
  t.afterEach(async () => {
    await release?.()
    release = undefined
  })
}

test.describe('Korb mit Seed-Ankern', () => {
  holdListData(test, 'shared')
  holdRates(test)

  test('SEED-SPEC §17 S01 + S11: Keramik 8,90 €, Zwischensumme 109,00 €, Gesamt 117,90 €; Aufruf setzt kein Cookie und reserviert nichts (EK-04)', async ({
    page,
    context,
    foreignRequests,
  }) => {
    const s01 = await productByNumber(901)
    const s11 = await productByNumber(911)
    await setCart(context, [
      { id: s01.id, p: s01.priceCents },
      { id: s11.id, p: s11.priceCents },
    ])
    const before = await context.cookies()
    const res = await page.goto(R06.de)
    expect(res?.status()).toBe(200)
    expect(await res?.headerValue('set-cookie')).toBeNull()
    // Gegen den Produktions-Build exakt; `next dev` setzt für dynamische Seiten eigene No-Cache-Header.
    if (process.env.E2E_SERVER === 'start')
      expect(res?.headers()['cache-control']).toBe('private, no-store')
    else expect(res?.headers()['cache-control']).toMatch(/private, no-store|no-(store|cache)/)
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
    await expect(page.locator('body')).toHaveAttribute('data-preset', 'calm')
    await expect(page.locator('h1')).toHaveText('Dein Korb')

    const lines = page.locator('[data-cart-line]')
    await expect(lines).toHaveCount(2)
    const s01Line = page.locator(`[data-cart-line="${s01.id}"]`)
    await expect(s01Line.locator('[data-cart-line-meta]')).toHaveText('Nr. 901 · Keramik')
    await expect(s01Line.locator('a')).toHaveAttribute(
      'href',
      '/de/shop/901-schale-langohr-wuschel',
    )
    await expect(s01Line.locator('img')).toHaveCount(1)
    expect(norm(await s01Line.locator('[data-cart-line-price]').innerText())).toBe(
      norm(euro(s01.priceCents)),
    )

    await expect(page.locator('[data-shipping-class-line]')).toHaveText(
      'Versandklasse: Keramik-Paket – die größte Klasse im Korb zählt',
    )
    await expect(page.locator('[data-delivery-option="shipping"]')).toContainText(
      'Versand innerhalb Deutschlands (DHL)',
    )
    expect(
      norm(await page.locator('[data-delivery-option="shipping"] [data-money]').innerText()),
    ).toBe(norm(euro(890)))
    await expect(page.locator('#cart-delivery-shipping')).toBeChecked()
    await expectAmount(page, '[data-cart-subtotal]', 10_900)
    await expectAmount(page, '[data-cart-shipping]', 890)
    await expectAmount(page, '[data-cart-total]', 11_790)
    await expect(page.locator('[data-cart-summary] [data-price-note]')).toContainText('§ 19 UStG')
    await expect(page.locator('main')).not.toContainText(/inkl\.?\s*(MwSt|USt)/)
    await expect(page.locator('[data-coco-slot][data-coco-pose="sitzen"]')).toBeVisible()
    const checkout = page.locator('[data-cart-checkout] button[type="submit"]')
    await expect(checkout).toHaveText('Zur Kasse')
    await expect(checkout).not.toHaveAttribute('aria-disabled', 'true')
    await expect(page.locator('[data-cart-checkout]')).toHaveAttribute('data-cart-checkout', '')

    // Seitenaufruf: keine Reservierung, Cookies unverändert, kein Stripe (AK-DS-11-Teil), keine Fremd-Requests.
    expect((await productByNumber(901)).status).toBe('available')
    expect((await productByNumber(911)).status).toBe('available')
    expect(await context.cookies()).toEqual(before)
    await page.waitForLoadState('networkidle')
    expect(foreignRequests).toEqual([])
    expect(await page.content()).not.toMatch(/stripe\.(com|network)/)
  })

  test('AK-DS-11 Preset calm: keine Animation, keine Transition in <main>; keine Anfrage an Stripe', async ({
    page,
    context,
  }) => {
    const stripe: string[] = []
    page.on('request', (r) => {
      if (/stripe\.(com|network)/.test(r.url())) stripe.push(r.url())
    })
    const s01 = await productByNumber(901)
    await setCart(context, [{ id: s01.id, p: s01.priceCents }])
    await page.goto(R06.de)
    await expectCalm(page, R06.de)
    expect(stripe).toEqual([])
  })

  test('Entfernen und Lieferart (mit JavaScript): Cookie aktualisiert, Summen neu, Abholung 0,00 €', async ({
    page,
    context,
  }) => {
    const s01 = await productByNumber(901)
    const s11 = await productByNumber(911)
    await setCart(context, [
      { id: s01.id, p: s01.priceCents },
      { id: s11.id, p: s11.priceCents },
    ])
    await page.goto(R06.de)
    await page.locator(`[data-cart-remove="${s01.id}"]`).click()
    await expect(page.locator('[data-cart-line]')).toHaveCount(1)
    const cookie = (await context.cookies()).find((c) => c.name === 'pc_cart')!
    expect(decodeCartCookie(cookie.value)?.items.map((i) => i.id)).toEqual([s11.id])
    await expectAmount(page, '[data-cart-subtotal]', s11.priceCents)
    await expect(page.locator('[data-shipping-class-line]')).toContainText('Paket klein')

    await page.locator('label[for="cart-delivery-pickup"]').click()
    await page.locator('[data-cart-delivery] button[type="submit"]').click()
    await expect(page.locator('#cart-delivery-pickup')).toBeChecked()
    await expectAmount(page, '[data-cart-shipping]', 0)
    await expectAmount(page, '[data-cart-total]', s11.priceCents)
    await expect(page.locator('[data-cart-summary] [data-delivery-time="pickup"]')).toContainText(
      'Abholbereit innerhalb von 2–5 Werktage',
    )
    const after = (await context.cookies()).find((c) => c.name === 'pc_cart')!
    expect(decodeCartCookie(after.value)?.delivery).toBe('pickup')

    // Letztes Stück entfernen → Leerzustand, Cookie gelöscht.
    await page.locator(`[data-cart-remove="${s11.id}"]`).click()
    await expect(page.locator('[data-cart-empty]')).toBeVisible()
    expect((await context.cookies()).map((c) => c.name)).not.toContain('pc_cart')
  })

  test('Leerzustand KO-17 ohne Cookie: „Noch liegt nichts in deinem Korb.“ + „Zum Shop“; setzt kein Cookie', async ({
    page,
    context,
  }) => {
    const res = await page.goto(R06.en)
    expect(res?.status()).toBe(200)
    await expect(page.locator('h1')).toHaveText('Your cart')
    await expect(page.locator('[data-empty-state] h2')).toHaveText(
      'Nothing lies in your basket yet.',
    )
    await expect(page.locator('[data-empty-state] a')).toHaveAttribute('href', '/en/shop')
    await page.goto(R06.de)
    await expect(page.locator('[data-empty-state] h2')).toHaveText(
      'Noch liegt nichts in deinem Korb.',
    )
    await expect(page.locator('[data-empty-state] a')).toHaveText(/Zum Shop/)
    expect(await context.cookies()).toEqual([])
    expect(
      await page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie]),
    ).toEqual([0, 0, ''])
  })
})

test.describe('Zustände mit Fixture-Stücken', () => {
  holdRates(test)

  test('reserviert (fremde Kasse), verkauft, Preis geändert, nur Abholung: Hinweise, gedämpft, aus der Summe, „Zur Kasse“ aria-disabled', async ({
    page,
    context,
    fixtureProducts,
  }) => {
    const until = new Date(Date.now() + 24 * 3600_000).toISOString()
    const free = await fixtureProducts.create('keramik', { ...PUBLISHED, priceCents: 3000 })
    const reserved = await fixtureProducts.create('keramik', {
      ...PUBLISHED,
      status: 'reserved',
      reservedUntil: until,
      reservationRef: 'e2e-fremde-kasse',
    })
    const sold = await fixtureProducts.create('keramik', {
      ...PUBLISHED,
      status: 'sold',
      soldAt: '2026-09-28T13:00:00.000Z',
      soldChannel: 'offline',
    })
    await setCart(context, [
      { id: free.id, p: 2500 },
      { id: reserved.id, p: 4500 },
      { id: sold.id, p: 4500 },
    ])
    await page.goto(R06.de)
    const line = (id: number) => page.locator(`[data-cart-line="${id}"]`)
    await expect(line(free.id)).toHaveAttribute('data-purchasable', 'true')
    await expect(line(free.id).locator('[data-cart-line-note="price-changed"]')).toHaveText(
      'Preis wurde aktualisiert',
    )
    expect(norm(await line(free.id).locator('[data-cart-line-price]').innerText())).toBe(
      norm(euro(3000)),
    )
    await expect(line(reserved.id)).toHaveAttribute('data-purchasable', 'false')
    await expect(line(reserved.id).locator('[data-cart-line-note]')).toHaveText(
      'Gerade reserviert – schau in 30 Minuten nochmal',
    )
    await expect(line(sold.id)).toHaveAttribute('data-purchasable', 'false')
    await expect(line(sold.id).locator('[data-cart-line-note="sold"]')).toHaveText(
      'Leider schon verkauft',
    )
    // Nur das freie Stück zählt, mit dem DB-Preis.
    await expectAmount(page, '[data-cart-subtotal]', 3000)
    await expectAmount(page, '[data-cart-total]', 3000 + 890)
    const checkout = page.locator('[data-cart-checkout] button[type="submit"]')
    await expect(checkout).toHaveAttribute('aria-disabled', 'true')
    await expect(checkout).toHaveAttribute('aria-describedby', 'cart-checkout-hint')
    await expect(page.locator('#cart-checkout-hint [data-blocker="unavailable"]')).toBeVisible()

    // Server lehnt den Kassenstart trotzdem ab (POST) → zurück auf den Korb mit Hinweis, keine Reservierung.
    // `aria-disabled` bleibt bedienbar (Playwright würde warten) – der Server lehnt ab.
    await checkout.click({ force: true })
    await expect(page.locator('[data-cart-notice]')).toBeVisible()
    expect(page.url()).toContain('/de/warenkorb')
    const payload = await testPayload()
    const freeDoc = await payload.findByID({
      collection: 'products',
      id: free.id,
      overrideAccess: true,
    })
    expect(freeDoc.status).toBe('available')

    // Nur Abholung: Versand ausgegraut mit „Nr. … gibt es nur zur Abholung“, Abholung gewählt.
    const pickupOnly = await fixtureProducts.create('keramik', {
      ...PUBLISHED,
      shippingClass: 'nur_abholung',
    })
    await setCart(context, [
      { id: free.id, p: 3000 },
      { id: pickupOnly.id, p: 4500 },
    ])
    await page.goto(R06.de)
    await expect(page.locator('#cart-delivery-shipping')).toBeDisabled()
    await expect(page.locator('#cart-delivery-pickup')).toBeChecked()
    await expect(page.locator('[data-cart-delivery]')).toContainText(
      `Nr. ${pickupOnly.itemNumber} gibt es nur zur Abholung.`,
    )
    await expectAmount(page, '[data-cart-shipping]', 0)
  })
})

test.describe('Countdown KO-15 im Korb (P4.9, V-17)', () => {
  let used: number[] = []
  test.afterEach(async () => {
    await cleanupCheckouts(used)
    used = []
  })

  test('V-17 Countdown im Korb nur bei einer echten Reservierung dieser Person, dieselbe Restzeit wie in der Kasse; ohne pc_checkout und nach Ablauf keiner', async ({
    page,
    context,
    fixtureProducts,
  }) => {
    const a = await fixtureProducts.create('keramik', PUBLISHED)
    used.push(a.id)
    await setCart(context, [{ id: a.id, p: 4500 }])
    await page.goto(R06.de)
    await expect(page.locator('[data-countdown]')).toHaveCount(0)

    const started = await startCheckoutFor(context, page, [{ id: a.id, priceCents: 4500 }])
    const checkoutTimer = page.locator('[data-countdown="full"]').getByRole('timer')
    await expect(checkoutTimer).toHaveText(/^\d\d:\d\d$/)
    const expiresAt = await page.locator('[data-countdown="full"]').getAttribute('data-expires-at')

    await page.goto(R06.de)
    const cartBox = page.locator('[data-countdown="full"]')
    await expect(cartBox).toBeVisible()
    await expect(cartBox).toHaveAttribute('data-expires-at', expiresAt!)
    await expect(cartBox.getByRole('timer')).toHaveText(/^(29|30):\d\d$/)

    // Andere Person (ohne pc_checkout): kein Countdown.
    const other = await context.browser()!.newContext()
    try {
      const otherPage = await other.newPage()
      await other.addCookies((await context.cookies()).filter((c) => c.name === 'pc_cart'))
      await otherPage.goto(R06.de)
      await expect(otherPage.locator('[data-cart-lines]')).toBeVisible()
      await expect(otherPage.locator('[data-countdown]')).toHaveCount(0)
    } finally {
      await other.close()
    }

    // Nach Ablauf des Countdowns: keiner mehr im Korb.
    await (
      await db()
    ).execute(
      sql`UPDATE checkouts SET display_expires_at = now() - interval '1 minute' WHERE id = ${started.checkoutId}`,
    )
    await page.goto(R06.de)
    await expect(page.locator('[data-cart-lines]')).toBeVisible()
    await expect(page.locator('[data-countdown]')).toHaveCount(0)
  })
})

test.describe('Shop pausiert (exklusiv, nur desktop)', () => {
  holdListData(test, 'exclusive')

  test('KONZEPT §3.6: closedMessage über den Positionen, „Zur Kasse“ aria-disabled', async ({
    page,
    context,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'globale Einstellung – einmal je Lauf')
    const payload = await testPayload()
    const s01 = await productByNumber(901)
    await setCart(context, [{ id: s01.id, p: s01.priceCents }])
    await payload.updateGlobal({
      slug: 'settings',
      data: { shop: { isOpen: false } } as never,
      overrideAccess: true,
      context: { seed: true },
    })
    try {
      await page.goto(R06.de)
      const closed = page.locator('[data-shop-closed]')
      await expect(closed).toBeVisible()
      const text = (await closed.innerText()).trim()
      expect(text.length).toBeGreaterThan(5)
      const isBefore = await page.evaluate(() => {
        const a = document.querySelector('[data-shop-closed]')
        const b = document.querySelector('[data-cart-lines]')
        return !!a && !!b && !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
      })
      expect(isBefore).toBe(true)
      await expect(page.locator('[data-cart-checkout] button[type="submit"]')).toHaveAttribute(
        'aria-disabled',
        'true',
      )
      await expect(page.locator('[data-blocker="shop_closed"]')).toBeVisible()
    } finally {
      await payload.updateGlobal({
        slug: 'settings',
        data: { shop: { isOpen: true } } as never,
        overrideAccess: true,
        context: { seed: true },
      })
    }
  })
})

test.describe('ohne JavaScript', () => {
  test.use({ javaScriptEnabled: false })
  holdListData(test, 'shared')
  holdRates(test)

  test('Formulare mit POST + 303: Lieferart wechseln und Entfernen', async ({ page, context }) => {
    const s01 = await productByNumber(901)
    const s11 = await productByNumber(911)
    await setCart(context, [
      { id: s01.id, p: s01.priceCents },
      { id: s11.id, p: s11.priceCents },
    ])
    await page.goto(R06.de)
    await page.locator('label[for="cart-delivery-pickup"]').click()
    const [post] = await Promise.all([
      page.waitForResponse((r) => r.request().method() === 'POST'),
      page.locator('[data-cart-delivery] button[type="submit"]').click(),
    ])
    expect(post.status()).toBe(303)
    await expect(page.locator('#cart-delivery-pickup')).toBeChecked()
    await expectAmount(page, '[data-cart-total]', 10_900)

    await page.locator(`[data-cart-remove="${s11.id}"]`).click()
    await expect(page.locator('[data-cart-line]')).toHaveCount(1)
    expect(page.url()).toMatch(/\/de\/warenkorb$/)
  })
})

test.describe('Barrierefreiheit', () => {
  holdListData(test, 'shared')
  holdRates(test)

  test('T-11 R06 gefüllt und leer (DE/EN) axe @a11y', async ({ page, context }) => {
    for (const locale of ['de', 'en'] as const) {
      await context.clearCookies()
      await page.goto(R06[locale])
      await expectNoSeriousViolations(page, `${R06[locale]} leer`)
    }
    const s01 = await productByNumber(901)
    await setCart(context, [{ id: s01.id, p: s01.priceCents + 100 }])
    for (const locale of ['de', 'en'] as const) {
      await page.goto(R06[locale])
      await expectNoSeriousViolations(page, `${R06[locale]} gefüllt`)
    }
  })
})
