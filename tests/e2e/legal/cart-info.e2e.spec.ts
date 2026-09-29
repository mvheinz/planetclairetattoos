import { holdShippingRates, type ReleaseLock } from '../../helpers/adminSessionLock'
import { R06, expectAmount, productByNumber, setCart } from '../cart/cartHelpers'
import { expect, test } from '../fixtures'
import { holdListData } from '../shop/fresh'
import { isBefore } from '../shop/productPage'
import { expectWarrantyNotice } from './warranty'

// P4.8 Pflichtangaben im Korb (RECHT R-031, R-035, R-036, R-049; KONZEPT §3.6): Versandkosten beziffert, Lieferzeit,
// Zahlarten und Liefergebiet vor dem Kassenknopf, harmonisierte Mitteilung.

holdListData(test, 'shared')
let release: ReleaseLock | undefined
test.beforeEach(async ({ context }) => {
  release = await holdShippingRates('shared')
  const s01 = await productByNumber(901)
  const s20 = await productByNumber(920)
  await setCart(context, [
    { id: s01.id, p: s01.priceCents },
    { id: s20.id, p: s20.priceCents },
  ])
})
test.afterEach(async () => {
  await release?.()
  release = undefined
})

test('R-031 Versandkosten konkret beziffert (Brief + Keramik → 8,90 €) vor dem Wechsel zur Kasse', async ({
  page,
}) => {
  await page.goto(R06.de)
  await expectAmount(page, '[data-cart-shipping]', 890)
  expect(
    await isBefore(
      page.locator('[data-cart-shipping]'),
      page.locator('[data-cart-checkout] button'),
    ),
  ).toBe(true)
})

test('R-035 Lieferzeit im Korb sichtbar', async ({ page }) => {
  await page.goto(R06.de)
  const time = page.locator('[data-cart-summary] [data-delivery-time="shipping"]')
  await expect(time).toBeVisible()
  await expect(time).toHaveText('Lieferzeit: 2–5 Werktage (bei Vorkasse ab Zahlungseingang)')
  await page.goto(R06.en)
  await expect(page.locator('[data-cart-summary] [data-delivery-time="shipping"]')).toHaveText(
    'Delivery time: 2–5 working days (for payment in advance, from receipt of payment)',
  )
})

test('R-036 Zahlarten und Liefergebiet stehen im DOM vor dem Kassenknopf', async ({ page }) => {
  for (const locale of ['de', 'en'] as const) {
    await page.goto(R06[locale])
    const info = page.locator('[data-cart-payment-info]')
    await expect(info).toBeVisible()
    const text = await info.innerText()
    for (const m of ['Apple Pay', 'Google Pay', 'PayPal']) expect(text).toContain(m)
    expect(text).toContain(locale === 'de' ? 'Vorkasse' : 'Payment in advance')
    expect(text).toContain(
      locale === 'de' ? 'nur innerhalb Deutschlands' : 'only deliver within Germany',
    )
    await expect(page.locator('[data-payment-methods]')).toHaveText(
      locale === 'de'
        ? 'Karte · Apple Pay · Google Pay · PayPal · Vorkasse'
        : 'Card · Apple Pay · Google Pay · PayPal · Payment in advance',
    )
    expect(await isBefore(info, page.locator('[data-cart-checkout] button'))).toBe(true)
  }
})

test('R-049 harmonisierte Mitteilung im Korb', async ({ page }) => {
  for (const locale of ['de', 'en'] as const) {
    await page.goto(R06[locale])
    await expectWarrantyNotice(page, locale)
  }
})
