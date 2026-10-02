import { holdShippingRates, type ReleaseLock } from '../../helpers/adminSessionLock'
import { cleanupCheckouts } from '../checkout/checkoutHelpers'
import { watchCsp } from '../csp'
import { adminPath, expect, test } from '../fixtures'
import { PUBLISHED } from '../shop/productPage'
import {
  addToCartFromProduct,
  adminPageIn,
  buyer,
  checkoutStatuses,
  choosePayment,
  choosePickup,
  distinctPages,
  expectMails,
  fillShipping,
  goToCheckout,
  orderAndThank,
  orderButton,
  ordersOf,
} from './purchaseHelpers'

// P4.24 Kaufpfad Vorkasse (KONZEPT §4.8, EK-02): Bestellung entsteht mit dem Klick (`awaiting_prepayment`, M02), die
// Danke-Seite zeigt die Bankdaten; die Verwaltung trägt „Zahlung erhalten“ ein → `paid`, M05 mit Rechnung. Abholung
// mit Vorkasse verlangt die Rechnungsadresse (K-07).

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

test('EK-02 @smoke Vorkasse mit Versand → Danke-Seite mit Bankdaten → Verwaltung „Zahlung erhalten“ → bezahlt; M02, dann M05', async ({
  page,
  context,
  request,
  browser,
  fixtureProducts,
}) => {
  test.slow()
  const p = await fixtureProducts.create('keramik', { ...PUBLISHED, priceCents: 4500 })
  used.push(p.id)
  const b = await buyer(context, page)
  const csp = await watchCsp(page)
  await addToCartFromProduct(page, request, p.itemNumber)
  const token = await goToCheckout(context, page)
  await fillShipping(page, b.email)
  await choosePayment(page, 'prepayment')
  expect(await ordersOf([p.id])).toEqual([])
  const thanks = await orderAndThank(page, token)
  await expect(thanks).toHaveAttribute('data-thanks-state', 'prepayment')
  const bank = page.locator('[data-bank-details]')
  await expect(bank.locator('[data-bank-iban]')).toHaveText(/^DE\d{2}( \d{4}){4} \d{2}$/)
  expect(distinctPages(b)).toHaveLength(4)
  const [order] = await ordersOf([p.id])
  expect(order).toMatchObject({ status: 'awaiting_prepayment', paymentMethod: 'prepayment' })
  await expect(bank.locator('[data-bank-reference]')).toHaveText(order!.orderNumber)
  expect(await checkoutStatuses([p.id])).toEqual(['completed'])
  await expectMails(b.email, ['prepayment_instructions'])
  expect(await csp()).toEqual([])
  expect(b.errors).toEqual([])

  const admin = await adminPageIn(browser)
  try {
    await admin.page.goto(adminPath(`/collections/orders/${order!.id}`))
    const box = admin.page.getByTestId('order-actions')
    await box.getByRole('button', { name: 'Zahlung erhalten' }).click()
    const dialog = admin.page.getByRole('dialog', { name: 'Zahlung erhalten' })
    await expect(dialog.getByLabel('Eingegangener Betrag (Euro)')).toHaveValue('53,90')
    await Promise.all([
      admin.page.waitForResponse((r) =>
        r.url().includes(`/orders/${order!.id}/prepayment-received`),
      ),
      dialog.getByRole('button', { name: 'Bestätigen' }).click(),
    ])
  } finally {
    await admin.close()
  }
  await expect.poll(async () => (await ordersOf([p.id]))[0]?.status).toBe('paid')
  await expectMails(b.email, ['prepayment_instructions', 'prepayment_received'])
})

test('EK-02 Abholung mit Vorkasse: ohne Rechnungsadresse Fehler, mit Rechnungsadresse Bestellung `awaiting_prepayment` (Abholung); M02', async ({
  page,
  context,
  request,
  fixtureProducts,
}) => {
  const p = await fixtureProducts.create('keramik', { ...PUBLISHED, priceCents: 4500 })
  used.push(p.id)
  const b = await buyer(context, page)
  const csp = await watchCsp(page)
  await addToCartFromProduct(page, request, p.itemNumber)
  const token = await goToCheckout(context, page)
  await page.locator('#checkout-delivery-pickup').check()
  await expect(page.locator('[data-overview-shipping="pickup"]')).toBeVisible()
  await page.locator('#checkout-email').fill(b.email)
  await page.locator('#checkout-name').fill('Erika Beispiel')
  await choosePayment(page, 'prepayment')
  await orderButton(page).click()
  const summary = page.locator('[data-error-summary]')
  await expect(summary).toBeFocused()
  for (const key of ['billingLine1', 'billingPostalCode', 'billingCity']) {
    await expect(summary.locator(`[data-error-link="${key}"]`)).toBeVisible()
  }
  expect(await ordersOf([p.id])).toEqual([])

  await choosePickup(page, b.email)
  const thanks = await orderAndThank(page, token)
  await expect(thanks).toHaveAttribute('data-thanks-state', 'prepayment')
  expect(distinctPages(b)).toHaveLength(4)
  expect(await ordersOf([p.id])).toMatchObject([
    { status: 'awaiting_prepayment', paymentMethod: 'prepayment', fulfillmentMethod: 'pickup' },
  ])
  await expectMails(b.email, ['prepayment_instructions'])
  expect(await csp()).toEqual([])
  expect(b.errors).toEqual([])
})
