import { holdShippingRates, type ReleaseLock } from '../../helpers/adminSessionLock'
import { cleanupCheckouts } from '../checkout/checkoutHelpers'
import { watchCsp } from '../csp'
import { expect, test } from '../fixtures'
import { mockPayments } from '../order/orderFixtures'
import { PUBLISHED } from '../shop/productPage'
import {
  addToCartFromProduct,
  buyer,
  checkoutOf,
  checkoutStatuses,
  chooseMock,
  choosePayment,
  choosePickup,
  distinctPages,
  expectMails,
  fillShipping,
  goToCheckout,
  mailTypes,
  orderAndThank,
  orderButton,
  ordersOf,
  R07,
  type Buyer,
} from './purchaseHelpers'

// P4.24 Kaufpfad Ende-zu-Ende mit dem Mock-Anbieter (KONZEPT §4.7, EK-02): Produktseite → Korb → Kasse → Danke in
// höchstens 4 Seiten, auf `iphone-15` und `pixel-7` (Projekt `desktop` ignoriert `purchase/`, playwright.config.ts).
// Karte mit Versand, Wallet (Mock `apple_pay`) mit Abholung, PayPal „Abbruch“ → „Zurück zur Kasse“ → „Erfolg“,
// „Abgelehnt“ → erneuter Versuch bzw. Wechsel auf Vorkasse, „Verzögert“ → Danke-Seite wartet → Rückfall
// `getCheckoutSession` meldet „bezahlt“. Je Fall: keine Bestellung vor der bestätigten Zahlung, Mails im Datei-Treiber,
// keine Konsolenfehler und keine CSP-Verstöße.

let used: number[] = []
let release: ReleaseLock | undefined
test.beforeEach(async () => {
  release = await holdShippingRates('shared')
})
test.afterEach(async () => {
  await cleanupCheckouts(used)
  used = []
  await release?.()
  release = undefined
})

type Fx = {
  create: (c: 'keramik', o?: Record<string, unknown>) => Promise<{ id: number; itemNumber: number }>
}

async function piece(fixtureProducts: Fx) {
  const p = await fixtureProducts.create('keramik', { ...PUBLISHED, priceCents: 4500 })
  used.push(p.id)
  return p
}

async function clean(b: Buyer, csp: () => Promise<string[]>) {
  expect(await csp(), 'CSP-Verstöße').toEqual([])
  expect(b.errors, 'Konsolenfehler').toEqual([])
}

test('EK-02 @smoke Karte „Erfolg“ mit Versand: Produkt → Korb → Kasse → Danke in 4 Seiten; Bestellung erst nach der Zahlung; M01', async ({
  page,
  context,
  request,
  fixtureProducts,
}) => {
  const p = await piece(fixtureProducts)
  const b = await buyer(context, page)
  const csp = await watchCsp(page)
  await addToCartFromProduct(page, request, p.itemNumber)
  const token = await goToCheckout(context, page)
  await fillShipping(page, b.email)
  await choosePayment(page, 'stripe')
  await chooseMock(page, 'success', 'card')
  expect(await ordersOf([p.id])).toEqual([])
  const thanks = await orderAndThank(page, token)
  await expect(thanks).toHaveAttribute('data-thanks-state', 'paid')
  await expect(page.getByRole('heading', { level: 1, name: 'Danke!' })).toBeVisible()

  expect(distinctPages(b)).toHaveLength(4)
  const orders = await ordersOf([p.id])
  expect(orders).toMatchObject([
    {
      status: 'paid',
      paymentMethod: 'card',
      paymentMethodType: 'card',
      fulfillmentMethod: 'shipping',
    },
  ])
  expect(await checkoutStatuses([p.id])).toEqual(['completed'])
  await expect(thanks.locator('[data-thanks-order-number]')).toContainText(orders[0]!.orderNumber)
  await expectMails(b.email, ['order_confirmation'])
  await clean(b, csp)
})

test('EK-02 Karte mit Wallet-Kennung (Mock „Apple Pay“) und Abholung: bezahlt, Zahlart card/apple_pay, Abholung; M01', async ({
  page,
  context,
  request,
  fixtureProducts,
}) => {
  const p = await piece(fixtureProducts)
  const b = await buyer(context, page)
  const csp = await watchCsp(page)
  await addToCartFromProduct(page, request, p.itemNumber)
  const token = await goToCheckout(context, page)
  await choosePickup(page, b.email)
  await choosePayment(page, 'stripe')
  await chooseMock(page, 'success', 'apple_pay')
  const thanks = await orderAndThank(page, token)
  await expect(thanks).toHaveAttribute('data-thanks-state', 'paid')

  expect(distinctPages(b)).toHaveLength(4)
  expect(await ordersOf([p.id])).toMatchObject([
    {
      status: 'paid',
      paymentMethod: 'card',
      paymentMethodType: 'apple_pay',
      fulfillmentMethod: 'pickup',
    },
  ])
  await expectMails(b.email, ['order_confirmation'])
  await clean(b, csp)
})

test('EK-02 PayPal „Abbruch“ → „Zurück zur Kasse“ → erneut „Erfolg“: genau eine Bestellung (PayPal); M01 nur einmal', async ({
  page,
  context,
  request,
  fixtureProducts,
}) => {
  const p = await piece(fixtureProducts)
  const b = await buyer(context, page)
  const csp = await watchCsp(page)
  await addToCartFromProduct(page, request, p.itemNumber)
  const token = await goToCheckout(context, page)
  await fillShipping(page, b.email)
  await choosePayment(page, 'stripe')
  await chooseMock(page, 'cancelled', 'paypal')
  const thanks = await orderAndThank(page, token)
  await expect(thanks).toHaveAttribute('data-thanks-state', 'unpaid')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Die Zahlung hat nicht geklappt' }),
  ).toBeVisible()
  expect(await ordersOf([p.id])).toEqual([])
  expect((await checkoutOf(token)).status).toBe('open')
  expect(await mailTypes(b.email)).toEqual([])

  await page.getByRole('link', { name: 'Zurück zur Kasse' }).click()
  await page.waitForURL(new RegExp(`${R07.de}$`))
  await expect(page.locator('[data-checkout-form][data-hydrated="true"]')).toBeVisible()
  // Eingaben sind in der weiterlaufenden Kasse gespeichert (KONZEPT §4.4)
  await expect(page.locator('#checkout-email')).toHaveValue(b.email)
  await choosePayment(page, 'stripe')
  await chooseMock(page, 'success', 'paypal')
  await expect(await orderAndThank(page, token)).toHaveAttribute('data-thanks-state', 'paid')
  expect(await ordersOf([p.id])).toMatchObject([
    { status: 'paid', paymentMethod: 'paypal', paymentMethodType: 'paypal' },
  ])
  expect(await checkoutStatuses([p.id])).toEqual(['completed'])
  await expectMails(b.email, ['order_confirmation'])
  await clean(b, csp)
})

test('EK-02 Karte „Abgelehnt“ → Meldung → erneuter Versuch mit „Erfolg“: keine Bestellung vor der Zahlung', async ({
  page,
  context,
  request,
  fixtureProducts,
}) => {
  const p = await piece(fixtureProducts)
  const b = await buyer(context, page)
  const csp = await watchCsp(page)
  await addToCartFromProduct(page, request, p.itemNumber)
  const token = await goToCheckout(context, page)
  await fillShipping(page, b.email)
  await choosePayment(page, 'stripe')
  await chooseMock(page, 'declined', 'card')
  await orderButton(page).click()
  await expect(page.locator('[data-payment-error]')).toContainText('abgelehnt')
  await expect(orderButton(page)).toBeEnabled()
  expect((await checkoutOf(token)).status).toBe('open')
  expect(await ordersOf([p.id])).toEqual([])

  await chooseMock(page, 'success', 'card')
  await expect(await orderAndThank(page, token)).toHaveAttribute('data-thanks-state', 'paid')
  expect(distinctPages(b)).toHaveLength(4)
  expect(await ordersOf([p.id])).toMatchObject([{ status: 'paid', paymentMethod: 'card' }])
  await expectMails(b.email, ['order_confirmation'])
  // Die abgelehnte Zahlung erzeugt einen Konsoleneintrag des Browsers nur bei echten Fehlern – hier keinen.
  await clean(b, csp)
})

test('EK-02 „Abgelehnt“ → Wechsel auf Vorkasse: genau eine Bestellung `awaiting_prepayment`; M02', async ({
  page,
  context,
  request,
  fixtureProducts,
}) => {
  const p = await piece(fixtureProducts)
  const b = await buyer(context, page)
  const csp = await watchCsp(page)
  await addToCartFromProduct(page, request, p.itemNumber)
  const token = await goToCheckout(context, page)
  await fillShipping(page, b.email)
  await choosePayment(page, 'stripe')
  await chooseMock(page, 'declined', 'card')
  await orderButton(page).click()
  await expect(page.locator('[data-payment-error]')).toContainText('abgelehnt')
  expect(await ordersOf([p.id])).toEqual([])

  await choosePayment(page, 'prepayment')
  await expect(page.locator('[data-prepayment-info]')).toBeVisible()
  const thanks = await orderAndThank(page, token)
  await expect(thanks).toHaveAttribute('data-thanks-state', 'prepayment')
  const orders = await ordersOf([p.id])
  expect(orders).toMatchObject([{ status: 'awaiting_prepayment', paymentMethod: 'prepayment' }])
  expect(orders).toHaveLength(1)
  await expectMails(b.email, ['prepayment_instructions'])
  await clean(b, csp)
})

test('EK-02 „Verzögert“ → Danke-Seite wartet → Testhilfe setzt die Session auf bezahlt → „bezahlt“ nach der nächsten Abfrage (Rückfall getCheckoutSession); M01', async ({
  page,
  context,
  request,
  fixtureProducts,
}) => {
  const p = await piece(fixtureProducts)
  const b = await buyer(context, page)
  const csp = await watchCsp(page)
  await addToCartFromProduct(page, request, p.itemNumber)
  const token = await goToCheckout(context, page)
  await fillShipping(page, b.email)
  await choosePayment(page, 'stripe')
  await chooseMock(page, 'delayed', 'card')
  const thanks = await orderAndThank(page, token)
  await expect(thanks).toHaveAttribute('data-thanks-state', 'waiting')
  expect(await ordersOf([p.id])).toEqual([])
  expect((await checkoutOf(token)).status).toBe('confirming')
  expect(await mailTypes(b.email)).toEqual([])

  // Testhilfe: Mock-Zustand der Session auf bezahlt – ohne Webhook (der Job-Pfad S10 ist in P4.18 getestet).
  const session = (await checkoutOf(token)).session
  expect(session).toBeTruthy()
  await mockPayments().emit(session!, 'checkout.session.async_payment_succeeded')
  await expect(thanks).toHaveAttribute('data-thanks-state', 'paid', { timeout: 15_000 })
  expect(distinctPages(b)).toHaveLength(4)
  expect(await ordersOf([p.id])).toMatchObject([{ status: 'paid', paymentMethod: 'card' }])
  expect(await checkoutStatuses([p.id])).toEqual(['completed'])
  await expectMails(b.email, ['order_confirmation'])
  await clean(b, csp)
})
