import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test'
import * as cheerio from 'cheerio'

import { formatMoney } from '../../../src/lib/money'
import { localizedPath } from '../../../src/lib/routes/paths'
import { holdShippingRates, type ReleaseLock } from '../../helpers/adminSessionLock'
import { adminCall, adminLogin, currentShippingRates } from '../adminApi'
import { cleanupCheckouts } from '../checkout/checkoutHelpers'
import { watchCsp } from '../csp'
import { expect, test, testPayload } from '../fixtures'
import { PUBLISHED } from '../shop/productPage'
import {
  addToCartFromProduct,
  buyer,
  checkoutOf,
  checkoutStatuses,
  chooseMock,
  choosePayment,
  endCountdown,
  expectMails,
  expireReservation,
  fillShipping,
  goToCheckout,
  mailTypes,
  orderAndThank,
  orderButton,
  ordersOf,
  R06,
  R07,
} from './purchaseHelpers'

// P4.24 Reservierung im Kaufpfad (KONZEPT §4.6, KO-15, EK-03): Ablauf des Countdowns mit `page.clock` → „Deine
// Reservierung ist abgelaufen.“ → „Nochmal reservieren“ legt eine neue Kasse an; zwei Käufer:innen in zwei
// Browser-Kontexten klicken gleichzeitig „Zur Kasse“ → genau eine Kasse, die andere sieht „gerade reserviert“; nach Ablauf
// der ersten Reservierung kauft die zweite. AK-3-10 (Korb/Kasse-Teil): geänderter Klassenpreis gleich in R25, Korb und
// neuer Kasse. Die Server-Uhr läuft echt – Abläufe setzen die Zeitpunkte in der Test-DB in die Vergangenheit.

let used: number[] = []
let release: ReleaseLock | undefined
test.afterEach(async () => {
  await cleanupCheckouts(used)
  used = []
  await release?.()
  release = undefined
})

/** Zweiter Browser-Kontext mit demselben Geräteprofil wie das laufende Projekt. */
async function secondContext(browser: Browser, testInfo: TestInfo): Promise<BrowserContext> {
  const u = testInfo.project.use
  return browser.newContext({
    baseURL: u.baseURL,
    viewport: u.viewport,
    userAgent: u.userAgent,
    deviceScaleFactor: u.deviceScaleFactor,
    isMobile: u.isMobile,
    hasTouch: u.hasTouch,
  })
}

test.describe('Reservierung', () => {
  test.beforeEach(async () => {
    release = await holdShippingRates('shared')
  })

  test('KO-15 Ablauf mit page.clock → „Deine Reservierung ist abgelaufen.“ → „Nochmal reservieren“ öffnet eine neue Kasse (Stück frei); keine Bestellung, alte Kasse `cancelled`', async ({
    page,
    context,
    request,
    fixtureProducts,
  }) => {
    const p = await fixtureProducts.create('keramik', { ...PUBLISHED, priceCents: 4500 })
    used.push(p.id)
    const b = await buyer(context, page)
    const csp = await watchCsp(page)
    await page.clock.install({ time: new Date() })
    await addToCartFromProduct(page, request, p.itemNumber)
    const first = await goToCheckout(context, page)
    await fillShipping(page, b.email)
    const box = page.locator('[data-countdown="full"]')
    await expect(box.getByRole('timer')).toHaveText(/^(30:00|29:[0-5]\d)$/)

    await page.clock.fastForward('30:30')
    await expect(box).toHaveAttribute('data-level', 'expired')
    await expect(box.locator('[data-countdown-expired]')).toContainText(
      'Deine Reservierung ist abgelaufen.',
    )
    await expect(orderButton(page)).toBeDisabled()
    // Server: der Countdown ist ebenfalls vorbei (Reservierung noch gehalten → wird ersetzt).
    const old = await checkoutOf(first)
    await endCountdown(old.id)
    await page.clock.setSystemTime(new Date())

    await box.getByRole('button', { name: 'Nochmal reservieren' }).click()
    await expect
      .poll(async () => (await context.cookies()).find((c) => c.name === 'pc_checkout')?.value)
      .not.toBe(first)
    await page.waitForURL(new RegExp(`${R07.de}(\\?|$)`))
    const second = (await context.cookies()).find((c) => c.name === 'pc_checkout')!.value
    await expect(page.locator('[data-countdown="full"]')).toHaveAttribute('data-level', 'normal')
    expect((await checkoutOf(second)).status).toBe('open')
    expect((await checkoutOf(first)).status).toBe('cancelled')
    expect(await checkoutStatuses([p.id])).toEqual(['cancelled', 'open'])
    expect(await ordersOf([p.id])).toEqual([])
    expect(await mailTypes(b.email)).toEqual([])
    expect(await csp()).toEqual([])
    expect(b.errors).toEqual([])
  })

  test('EK-03 zwei Käufer:innen gleichzeitig „Zur Kasse“: genau eine Kasse, die andere sieht „gerade reserviert“; nach Ablauf der ersten Reservierung kauft die zweite', async ({
    page,
    context,
    request,
    browser,
    fixtureProducts,
  }, testInfo) => {
    const p = await fixtureProducts.create('keramik', { ...PUBLISHED, priceCents: 4500 })
    used.push(p.id)
    const otherContext = await secondContext(browser, testInfo)
    try {
      const other = await otherContext.newPage()
      const a = await buyer(context, page)
      const bb = await buyer(otherContext, other)
      await addToCartFromProduct(page, request, p.itemNumber)
      await addToCartFromProduct(other, request, p.itemNumber)

      const click = (pg: Page) => pg.locator('[data-cart-checkout] button[type="submit"]').click()
      await Promise.all([click(page), click(other)])
      const landed = async (pg: Page) => {
        await expect(pg).toHaveURL(new RegExp(`(${R07.de}|${R06.de}\\?hinweis=reserved)`))
        return new URL(pg.url()).pathname === R07.de ? 'checkout' : 'reserved'
      }
      const results = [await landed(page), await landed(other)]
      expect([...results].sort()).toEqual(['checkout', 'reserved'])
      expect(await checkoutStatuses([p.id])).toEqual(['open'])
      const [winner, loser] = results[0] === 'checkout' ? [page, other] : [other, page]
      const [winnerCtx, loserCtx] =
        winner === page ? [context, otherContext] : [otherContext, context]
      const loserBuyer = loser === page ? a : bb
      const winnerBuyer = winner === page ? a : bb
      await expect(loser.locator('[data-cart-notice="reserved"]')).toContainText(
        'gerade reserviert',
      )

      // Erste Reservierung läuft ab → die zweite Käuferin kann kaufen.
      const firstCheckout = await checkoutOf(await winnerTokenOf(winnerCtx))
      await expireReservation(firstCheckout.id)
      await loser.goto(R06.de)
      const token = await goToCheckout(loserCtx, loser)
      await fillShipping(loser, loserBuyer.email)
      await choosePayment(loser, 'stripe')
      await chooseMock(loser, 'success', 'card')
      await expect(await orderAndThank(loser, token)).toHaveAttribute('data-thanks-state', 'paid')

      expect(await checkoutStatuses([p.id])).toEqual(['expired', 'completed'])
      const orders = await ordersOf([p.id])
      expect(orders).toHaveLength(1)
      expect(orders[0]).toMatchObject({ status: 'paid' })
      await expectMails(loserBuyer.email, ['order_confirmation'])
      expect(await mailTypes(winnerBuyer.email)).toEqual([])
      expect([...a.errors, ...bb.errors]).toEqual([])
    } finally {
      await otherContext.close()
    }
  })
})

async function winnerTokenOf(ctx: BrowserContext): Promise<string> {
  const t = (await ctx.cookies()).find((c) => c.name === 'pc_checkout')?.value
  if (!t) throw new Error('Gewinner-Kontext ohne pc_checkout.')
  return t
}

test.describe('AK-3-10 Klassenpreis ändern (exklusiv)', () => {
  test.describe.configure({ timeout: 180_000 })

  test('AK-3-10 (Korb/Kasse): ein geänderter Klassenpreis erscheint in R25, im Korb und in einer neuen Kasse gleich', async ({
    page,
    context,
    request,
    fixtureProducts,
  }, testInfo) => {
    // Einstellungen sind global – einmal je Lauf (Projekt `pixel-7`), nicht parallel in beiden Mobil-Projekten.
    test.skip(testInfo.project.name !== 'pixel-7', 'globale Einstellung – einmal je Lauf')
    release = await holdShippingRates('exclusive')
    const p = await fixtureProducts.create('keramik', { ...PUBLISHED, priceCents: 4500 })
    used.push(p.id)
    const payload = await testPayload()
    const doc = await payload.findByID({
      collection: 'products',
      id: p.id,
      depth: 0,
      overrideAccess: true,
    })
    const cls = doc.shippingClass as string
    const original = await currentShippingRates()
    const rate = original.find((r) => r.zone === 'DE' && r.shippingClass === cls)
    expect(rate, `Versandpreis ${cls} (DE) im Grund-Seed`).toBeTruthy()
    const changed = rate!.priceCents + 70
    const want = formatMoney(changed, 'de').replace(/\s+/g, ' ')
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
    const R25 = localizedPath('R25', 'de')
    const r25Price = async () =>
      norm(
        cheerio
          .load(await (await request.get(R25)).text())(`[data-shipping-row="${cls}"] [data-money]`)
          .text(),
      )
    const admin = await adminLogin()
    try {
      await adminCall(request, admin, 'post', '/globals/settings', {
        shipping: {
          rates: original.map((r) => (r === rate ? { ...r, priceCents: changed } : r)),
        },
      })
      await expect.poll(r25Price, { timeout: 60_000, intervals: [250, 500, 1000] }).toBe(want)
      await buyer(context, page)
      await addToCartFromProduct(page, request, p.itemNumber)
      await expect
        .poll(async () => norm(await page.locator('[data-cart-shipping] [data-money]').innerText()))
        .toBe(want)
      await goToCheckout(context, page)
      expect(
        norm(await page.locator('[data-overview-shipping="shipping"] [data-money]').innerText()),
      ).toBe(want)
    } finally {
      await adminCall(request, admin, 'post', '/globals/settings', {
        shipping: { rates: original },
      })
      await admin.release()
      // Andere Tests lesen die Grund-Seed-Preise auf R25 wieder (erst danach den exklusiven Lock freigeben).
      await expect
        .poll(r25Price, { timeout: 60_000, intervals: [250, 500, 1000] })
        .toBe(norm(formatMoney(rate!.priceCents, 'de')))
    }
  })
})
