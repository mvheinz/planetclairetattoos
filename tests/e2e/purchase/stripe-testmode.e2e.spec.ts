import { expect, test } from '@playwright/test'

import { cleanupCheckouts } from '../checkout/checkoutHelpers'
import { testPayload } from '../fixtures'
import { PUBLISHED } from '../shop/productPage'
import { completeProduct, createProductFixtures } from '../../int/helpers/products'
import {
  addToCartFromProduct,
  buyer,
  choosePayment,
  fillShipping,
  goToCheckout,
  orderAndThank,
  ordersOf,
} from './purchaseHelpers'

// P4.24 optional: Stripe-Testmodus (Tag `@stripe`). Läuft nur mit `PAYMENTS_DRIVER=stripe` und einem Test-Schlüssel
// (`sk_test_…`, CLOUD-SETUP §3.9 – Jutta hinterlegt ihn freiwillig); sonst übersprungen. Payment Element mit der von
// Stripe veröffentlichten Testkarte 4242 4242 4242 4242, Rückkehr zur Danke-Seite, Bestellung `paid` über den Rückfall
// `getCheckoutSession` (Webhooks erreichen die Sandbox nicht). Einzige Datei, in der Playwright Stripe-Hosts erlaubt:
// Sie nutzt `@playwright/test` direkt statt der gemeinsamen Fixtures mit der Sperre fremder Hosts (`fixtures.ts`).

const enabled =
  process.env.PAYMENTS_DRIVER === 'stripe' &&
  (process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_test_')

test.skip(!enabled, 'Stripe-Testmodus nur mit PAYMENTS_DRIVER=stripe und sk_test_-Schlüssel')

test('@stripe Testkarte im Payment Element → Danke-Seite „bezahlt“ über getCheckoutSession', async ({
  page,
  context,
  request,
}, testInfo) => {
  test.slow()
  const payload = await testPayload()
  const itemNumber = 999 - (testInfo.project.name === 'pixel-7' ? 1 : 0)
  await payload.delete({
    collection: 'products',
    where: { itemNumber: { equals: itemNumber } },
    overrideAccess: true,
    context: { seed: true },
  })
  const fx = await createProductFixtures(payload)
  const doc = await payload.create({
    collection: 'products',
    data: { ...completeProduct('keramik', itemNumber, fx), seed: true, ...PUBLISHED } as never,
    overrideAccess: true,
    context: { seed: true },
  })
  const id = doc.id as number
  try {
    const b = await buyer(context, page)
    await addToCartFromProduct(page, request, itemNumber)
    const token = await goToCheckout(context, page)
    await fillShipping(page, b.email)
    await choosePayment(page, 'stripe')
    const frame = page.frameLocator('[data-payment-field="stripe"] iframe').first()
    await frame.getByLabel(/Card number|Kartennummer/).fill('4242 4242 4242 4242')
    await frame.getByLabel(/Expiration|Ablaufdatum/).fill('12 / 34')
    await frame.getByLabel(/CVC|Prüfziffer/).fill('123')
    const thanks = await orderAndThank(page, token)
    await expect(thanks).toHaveAttribute('data-thanks-state', 'paid', { timeout: 60_000 })
    expect(await ordersOf([id])).toMatchObject([{ status: 'paid', paymentMethod: 'card' }])
  } finally {
    await cleanupCheckouts([id])
    await payload.delete({
      collection: 'products',
      id,
      overrideAccess: true,
      context: { seed: true },
    })
  }
})
