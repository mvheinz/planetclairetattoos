import { cleanupCheckouts, hydrated, startCheckoutFor, R07 } from '../checkout/checkoutHelpers'
import { expect, test } from '../fixtures'
import { PUBLISHED } from '../shop/productPage'

// P4.9 Kasse R07 – Rechtsanforderungen an die Felder (RECHT R-061, R-101, R-138, V-03; KONZEPT §4.4): Pflichtfelder
// genau nach R-061 (kein Anrede-, Telefon-, Firmen-, Konto- oder Newsletterfeld, keine Checkbox „AGB akzeptieren“),
// DHL-Einwilligung optional und nicht angehakt nur bei Versand, Link zur Datenschutzerklärung am Formular,
// `autocomplete`-Attribute und keine vorangekreuzte Checkbox (auch nicht „Rechnungsadresse weicht ab“ und die
// Abweichungs-Bestätigung).

let used: number[] = []
test.afterEach(async () => {
  await cleanupCheckouts(used)
  used = []
})

test('R-061 Pflichtfelder genau; kein Anrede-, Telefon-, Firmen-, Konto- oder Newsletterfeld im DOM; autocomplete', async ({
  page,
  context,
  fixtureProducts,
}) => {
  const a = await fixtureProducts.create('keramik', PUBLISHED)
  used.push(a.id)
  await startCheckoutFor(context, page, [a])
  await hydrated(page)
  const required = await page
    .locator('[data-checkout-form] input[required]:visible')
    .evaluateAll((els) => els.map((e) => (e as HTMLInputElement).name))
  expect(required.sort()).toEqual(
    [
      'email',
      'name',
      'shippingAddress.addressLine1',
      'shippingAddress.postalCode',
      'shippingAddress.city',
    ].sort(),
  )
  const names = await page
    .locator(
      '[data-checkout-form] input, [data-checkout-form] select, [data-checkout-form] textarea',
    )
    .evaluateAll((els) =>
      els.map((e) => `${(e as HTMLInputElement).name} ${(e as HTMLInputElement).type}`),
    )
  for (const n of names) {
    expect(n).not.toMatch(
      /tel|phone|telefon|company|firma|salutation|anrede|iban|konto|newsletter|agb|terms/i,
    )
  }
  await expect(page.locator('#checkout-email')).toHaveAttribute('autocomplete', 'email')
  await expect(page.locator('#checkout-name')).toHaveAttribute('autocomplete', 'name')
  await expect(page.locator('#checkout-shipping-line1')).toHaveAttribute(
    'autocomplete',
    'shipping address-line1',
  )
  await expect(page.locator('#checkout-shipping-postal-code')).toHaveAttribute(
    'autocomplete',
    'shipping postal-code',
  )
  await expect(page.locator('#checkout-shipping-city')).toHaveAttribute(
    'autocomplete',
    'shipping address-level2',
  )
  await expect(page.locator('[data-country]')).toContainText('Deutschland')

  // „Rechnungsadresse weicht ab“ → Felder der Rechnungsadresse samt Name werden Pflicht (sichtbar).
  await page.getByLabel('Rechnungsadresse weicht ab').check()
  await expect(page.locator('#checkout-billing-name')).toBeVisible()
  await expect(page.locator('#checkout-billing-line1')).toBeVisible()
  // Abholung: Rechnungsadresse immer Pflicht (K-07), keine Lieferadresse.
  await page.locator('#checkout-delivery-pickup').check()
  await expect(page.locator('[data-overview-shipping="pickup"]')).toBeVisible()
  const pickupRequired = await page
    .locator('[data-checkout-form] input[required]:visible')
    .evaluateAll((els) => els.map((e) => (e as HTMLInputElement).name))
  expect(pickupRequired.sort()).toEqual(
    [
      'email',
      'name',
      'billingAddress.addressLine1',
      'billingAddress.postalCode',
      'billingAddress.city',
    ].sort(),
  )
})

test('R-101 DHL-Einwilligung: optional, nicht angehakt, Baustein-Text, nur bei Versand', async ({
  page,
  context,
  fixtureProducts,
}) => {
  const a = await fixtureProducts.create('keramik', PUBLISHED)
  used.push(a.id)
  await startCheckoutFor(context, page, [a])
  await hydrated(page)
  const consent = page.locator('#checkout-carrier-consent')
  await expect(consent).not.toBeChecked()
  await expect(consent).not.toHaveAttribute('required', /.*/)
  await expect(page.locator('[data-snippet="checkout.dhlEmailConsent"]')).toContainText('DHL')
  await page.locator('#checkout-delivery-pickup').check()
  await expect(page.locator('[data-overview-shipping="pickup"]')).toBeVisible()
  await expect(consent).toBeHidden()
})

test('R-138 Link zur Datenschutzerklärung am Formular; V-03 keine Checkbox beim Laden angehakt (auch Abweichung)', async ({
  page,
  context,
  fixtureProducts,
  request,
}) => {
  const a = await fixtureProducts.create('keramik', PUBLISHED)
  const b = await fixtureProducts.create('textil', {
    ...PUBLISHED,
    deviationDecision: 'described',
    hasDeviation: true,
    deviationDescription: 'Gestopfter Fleck an der linken Seitennaht',
  })
  used.push(a.id, b.id)
  await startCheckoutFor(context, page, [a, b])
  await expect(page.locator('[data-privacy-link] a')).toHaveAttribute('href', '/de/datenschutz')
  const checked = await page
    .locator('input[type="checkbox"]')
    .evaluateAll((els) => els.filter((e) => (e as HTMLInputElement).checked).length)
  expect(checked).toBe(0)
  await expect(page.locator('input[name="deviationAgreements"]')).toHaveCount(1)
  // Server-HTML ohne `checked` an Checkboxen
  const cookies = await context.cookies()
  const html = await (
    await request.get(R07.de, {
      headers: { cookie: cookies.map((c) => `${c.name}=${c.value}`).join('; ') },
    })
  ).text()
  expect(html).not.toMatch(
    /<input\b(?=[^>]*\btype="checkbox")(?=[^>]*\schecked(?:=""|\s|\/?>))[^>]*>/,
  )
})
