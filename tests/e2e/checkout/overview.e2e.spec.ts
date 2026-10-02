import { holdShippingRates, type ReleaseLock } from '../../helpers/adminSessionLock'
import { euro, norm } from '../cart/cartHelpers'
import { expect, test } from '../fixtures'
import { PUBLISHED } from '../shop/productPage'
import {
  R07,
  checkoutStatus,
  cleanupCheckouts,
  fillShipping,
  hydrated,
  orderButton,
  startCheckoutFor,
} from './checkoutHelpers'

// P4.10/P4.10a/P4.10b Kasse R07 – Übersicht und Bestellknopf (KONZEPT §4.5, R-063, R-064, R-048, R-137): Fixture-Korb
// analog S01 + S11 (Keramik 45,00 € und Textil 64,00 € mit Abweichung, Versand 8,90 €, Gesamt 117,90 €). Mit den
// echten Seed-Ankern prüft P8.21. Absenden mit Mock „Abgelehnt“ (S8) und „Erfolg“ (303 auf die Danke-Seite R08, deren
// Inhalt P4.17 baut – hier zählt die Weiterleitung und die URL ohne Eingaben).

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
  create: (
    c: 'keramik' | 'textil',
    o?: Record<string, unknown>,
  ) => Promise<{ id: number; itemNumber: number }>
}

async function basket(fixtureProducts: Fx) {
  const keramik = await fixtureProducts.create('keramik', { ...PUBLISHED, priceCents: 4500 })
  const textil = await fixtureProducts.create('textil', {
    ...PUBLISHED,
    priceCents: 6400,
    deviationDecision: 'described',
    hasDeviation: true,
    deviationDescription: 'Gestopfter Fleck an der linken Seitennaht',
  })
  used.push(keramik.id, textil.id)
  return { keramik, textil }
}

const FORBIDDEN_BUY =
  /^(kaufen|jetzt kaufen|bestellen|jetzt bestellen|weiter|abschicken|buy|buy now|order|order now|submit)$/i

test('R-064 genau ein Knopf „Zahlungspflichtig bestellen“ (EN „Order with obligation to pay“); keine verbotenen Kauf-Beschriftungen', async ({
  page,
  context,
  fixtureProducts,
}) => {
  const { keramik } = await basket(fixtureProducts)
  await startCheckoutFor(context, page, [{ id: keramik.id }])
  await hydrated(page)
  await expect(orderButton(page)).toHaveCount(1)
  await expect(orderButton(page)).toHaveText('Zahlungspflichtig bestellen')
  const labels = await page.getByRole('button').allInnerTexts()
  for (const l of labels) expect(l.trim()).not.toMatch(FORBIDDEN_BUY)
  await page.goto(R07.en)
  await hydrated(page)
  await expect(orderButton(page, 'en')).toHaveCount(1)
  for (const l of await page.getByRole('button').allInnerTexts()) {
    expect(l.trim()).not.toMatch(FORBIDDEN_BUY)
  }
})

test('R-063 Übersicht vor dem Knopf: Positionen mit Nr., Eigenschaften, Preis; Versand 8,90 €; Gesamt 117,90 €; Lieferzeit; Adressen; Zahlart; vier „Ändern“-Links springen und fokussieren ohne Datenverlust', async ({
  page,
  context,
  fixtureProducts,
}) => {
  const { keramik, textil } = await basket(fixtureProducts)
  await startCheckoutFor(context, page, [{ id: keramik.id }, { id: textil.id }])
  await hydrated(page)
  const overview = page.locator('#uebersicht')
  const items = overview.locator('[data-overview-item]')
  await expect(items).toHaveCount(2)
  for (const [p, cents] of [
    [keramik, 4500],
    [textil, 6400],
  ] as const) {
    const row = overview.locator(`[data-overview-item="${p.itemNumber}"]`)
    await expect(row.locator('[data-overview-item-number]')).toContainText(`Nr. ${p.itemNumber}`)
    await expect(row.locator('[data-overview-characteristics]')).not.toBeEmpty()
    expect(norm(await row.locator('[data-overview-price]').innerText())).toBe(norm(euro(cents)))
  }
  await expect(overview.locator(`[data-overview-item="${textil.itemNumber}"]`)).toContainText(
    'Gestopfter Fleck',
  )
  expect(norm(await overview.locator('[data-overview-shipping] dd').innerText())).toBe(
    norm(euro(890)),
  )
  await expect(overview.locator('[data-overview-shipping] dt')).toContainText('Keramik')
  expect(norm(await overview.locator('[data-overview-total] dd').innerText())).toBe(
    norm(euro(11790)),
  )
  await expect(overview).toContainText('§ 19 UStG')
  await expect(overview).not.toContainText('inkl. MwSt')
  await expect(overview.locator('[data-overview-delivery-time]')).toContainText('Werktage')

  await fillShipping(page, { email: 'uebersicht@planetclaire.local' })
  await expect(overview.locator('[data-overview-block="lieferung"]')).toContainText(
    'Musterstraße 1',
  )
  await expect(overview.locator('[data-overview-block="rechnung"]')).toContainText(
    'wie Lieferadresse',
  )
  await expect(overview.locator('[data-overview-block="kontakt"]')).toContainText(
    'uebersicht@planetclaire.local',
  )
  await expect(overview.locator('[data-overview-block="zahlart"]')).toContainText('Karte')

  // Übersicht steht vor dem Knopf (Dokument-Reihenfolge).
  const before = await page.evaluate(() => {
    const o = document.querySelector('#uebersicht')!
    const b = document.querySelector('[data-order-button]')!
    return !!(o.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
  })
  expect(before).toBe(true)

  const changes = overview.locator('a[data-change]')
  await expect(changes).toHaveCount(4)
  for (const [section, field] of [
    ['lieferung', '#checkout-delivery-shipping'],
    ['rechnung', '#checkout-billing-differs'],
    ['kontakt', '#checkout-email'],
    ['zahlart', '#checkout-payment-stripe'],
  ] as const) {
    const link = overview.locator(`a[data-change="${section}"]`)
    await expect(link).toHaveText('Ändern')
    await expect(link).toHaveAttribute('href', `#${section}`)
    await link.click()
    await expect(page).toHaveURL(new RegExp(`#${section}$`))
    await expect(page.locator(field)).toBeFocused()
  }
  await expect(page.locator('#checkout-email')).toHaveValue('uebersicht@planetclaire.local')
  await expect(page.locator('#checkout-shipping-line1')).toHaveValue('Musterstraße 1')
})

test('R-048 (Oberfläche): ohne Haken bei der Abweichung ist der Knopf deaktiviert und der Hinweis sichtbar; mit Haken aktiv', async ({
  page,
  context,
  fixtureProducts,
}) => {
  const { keramik, textil } = await basket(fixtureProducts)
  await startCheckoutFor(context, page, [{ id: keramik.id }, { id: textil.id }])
  await hydrated(page)
  const box = page.locator('input[name="deviationAgreements"]')
  await expect(box).toHaveCount(1)
  await expect(box).not.toBeChecked()
  await expect(page.locator('[data-snippet="checkout.deviationAgreement"]')).toContainText(
    'Gestopfter Fleck an der linken Seitennaht',
  )
  await expect(orderButton(page)).toBeDisabled()
  await expect(page.locator('[data-order-hint="deviation"]')).toBeVisible()
  await expect(orderButton(page)).toHaveAttribute('aria-describedby', 'checkout-order-hint')
  await box.check()
  await expect(orderButton(page)).toBeEnabled()
  await expect(page.locator('[data-order-hint="deviation"]')).toHaveCount(0)
})

test('S8 Mock „Abgelehnt“: Meldung im Zahlungsfeld, Kasse wieder offen, erneut bestellbar; R-137 „Erfolg“ → 303 auf /de/danke/<Token>, URL ohne Eingaben', async ({
  page,
  context,
  fixtureProducts,
}) => {
  const { keramik } = await basket(fixtureProducts)
  const started = await startCheckoutFor(context, page, [{ id: keramik.id }])
  await hydrated(page)
  await fillShipping(page, { email: 'bestellung@planetclaire.local' })
  await page.getByLabel('Abgelehnt', { exact: true }).check()
  await orderButton(page).click()
  await expect(page.locator('[data-payment-error]')).toContainText('abgelehnt')
  await expect(orderButton(page)).toBeEnabled()
  expect(await checkoutStatus(started.checkoutId)).toBe('open')
  expect(page.url()).not.toMatch(/bestellung@|Musterstra|10115|Erika/)

  await page.getByLabel('Erfolg', { exact: true }).check()
  const nav = page.waitForURL(new RegExp(`/de/danke/${started.token}$`))
  await orderButton(page).click()
  await nav
  expect(page.url()).not.toMatch(/bestellung|Musterstra|10115|Erika|%40|@/)
  await expect.poll(() => checkoutStatus(started.checkoutId)).toBe('completed')
})
