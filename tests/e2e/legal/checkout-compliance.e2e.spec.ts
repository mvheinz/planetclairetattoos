import { holdShippingRates, type ReleaseLock } from '../../helpers/adminSessionLock'
import { readOutbox } from '../../helpers/outbox'
import { euro, norm } from '../cart/cartHelpers'
import { cleanupCheckouts, fillShipping, startCheckoutFor } from '../checkout/checkoutHelpers'
import { expect, test } from '../fixtures'
import {
  addToCartFromProduct,
  buyer,
  chooseMock,
  choosePayment,
  goToCheckout,
  hydrated,
  orderAndThank,
  orderButton,
  ordersOf,
  R07,
} from '../purchase/purchaseHelpers'
import { isBefore, PUBLISHED } from '../shop/productPage'

// P6.12 – Prüf-Suite Bestellprozess (§ 312j, § 312i, § 312f BGB): bündelt die Nachweise für den in P4 gebauten Kaufweg
// auf `desktop`, `iphone-15` und `pixel-7` – Zahlarten/Liefergebiet zu Beginn (R-036), Übersicht unmittelbar vor dem
// Knopf (R-063), Knopf exakt „Zahlungspflichtig bestellen“ (R-064), Eingabefehler korrigierbar (R-065), Vertragsbestimmungen
// abrufbar und speicherbar (R-012), Zugangs- und Vertragsbestätigung M01 mit den Rechtstext-PDFs der Bestellfassung
// (R-081, R-013, AK-6-02). Den Kassen-Datensatz und die PDF-Anhänge im Einzelnen prüft
// `tests/int/legal/contract-confirmation.int.spec.ts`.

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

async function keramik(fixtureProducts: Fx) {
  const p = await fixtureProducts.create('keramik', { ...PUBLISHED, priceCents: 4500 })
  used.push(p.id)
  return p
}

const BUY_WORDS = /^(kaufen|jetzt kaufen|bestellen|jetzt bestellen|buy|buy now|order|order now)$/i

test('R-036 Zahlarten und Lieferbeschränkungen spätestens zu Beginn des Bestellvorgangs: Produktseite, Korb vor „Zur Kasse“, Kasse', async ({
  page,
  context,
  request,
  fixtureProducts,
}) => {
  const p = await keramik(fixtureProducts)
  await buyer(context, page)
  await addToCartFromProduct(page, request, p.itemNumber)
  const info = page.locator('[data-cart-payment-info]')
  await expect(info).toContainText('nur innerhalb Deutschlands')
  for (const m of ['Apple Pay', 'Google Pay', 'PayPal', 'Vorkasse'])
    await expect(info).toContainText(m)
  expect(await isBefore(info, page.locator('[data-cart-checkout] button'))).toBe(true)
  await goToCheckout(context, page)
  await expect(page.locator('[data-country]')).toContainText('Deutschland')
  await expect(page.locator('input[name="paymentChoice"][value="stripe"]')).toHaveCount(1)
  await expect(page.locator('input[name="paymentChoice"][value="prepayment"]')).toHaveCount(1)
})

test('R-064 genau ein Bestellknopf mit exakt „Zahlungspflichtig bestellen“ (EN „Order with obligation to pay“), ohne Icon; keine andere Kauf-Beschriftung', async ({
  page,
  context,
  fixtureProducts,
}) => {
  const p = await keramik(fixtureProducts)
  await startCheckoutFor(context, page, [{ id: p.id }])
  for (const locale of ['de', 'en'] as const) {
    if (locale === 'en') await page.goto(R07.en)
    await hydrated(page)
    const btn = orderButton(page, locale)
    await expect(btn).toHaveCount(1)
    await expect(btn).toHaveAttribute('type', 'submit')
    expect((await btn.innerText()).trim()).toBe(
      locale === 'de' ? 'Zahlungspflichtig bestellen' : 'Order with obligation to pay',
    )
    await expect(btn.locator('svg, img')).toHaveCount(0)
    await expect(page.locator('[data-checkout-form] [type="submit"]')).toHaveCount(1)
    for (const l of await page.getByRole('button').allInnerTexts()) {
      expect(l.trim()).not.toMatch(BUY_WORDS)
    }
  }
})

test('R-063 wesentliche Eigenschaften, Einzelpreis, Versandkosten, Gesamtpreis mit Kleinunternehmer-Hinweis und Lieferzeit stehen unmittelbar vor dem Knopf', async ({
  page,
  context,
  fixtureProducts,
}) => {
  const p = await keramik(fixtureProducts)
  await startCheckoutFor(context, page, [{ id: p.id }])
  await hydrated(page)
  const overview = page.locator('#uebersicht')
  const row = overview.locator(`[data-overview-item="${p.itemNumber}"]`)
  await expect(row.locator('[data-overview-item-number]')).toContainText(`Nr. ${p.itemNumber}`)
  await expect(row.locator('[data-overview-characteristics]')).not.toBeEmpty()
  expect(norm(await row.locator('[data-overview-price]').innerText())).toBe(norm(euro(4500)))
  await expect(overview.locator('[data-overview-shipping] dd')).not.toBeEmpty()
  expect(norm(await overview.locator('[data-overview-total]').innerText())).toMatch(/\d+,\d{2}\s?€/)
  await expect(overview).toContainText('§ 19 UStG')
  await expect(overview.locator('[data-overview-delivery-time]')).toContainText('Werktage')
  await expect(overview).not.toContainText(/inkl\.?\s*MwSt/i)
  // Unmittelbar: der Bestellbereich folgt direkt auf die Übersicht (DOM und Anzeige, auch mobil).
  const adjacent = await page.evaluate(() => {
    const area = document.querySelector('[data-order-area]')
    return area?.previousElementSibling?.id ?? null
  })
  expect(adjacent).toBe('uebersicht')
  const o = await overview.boundingBox()
  const b = await orderButton(page).boundingBox()
  expect(o && b && b.y >= o.y + o.height - 1).toBe(true)
  expect(o && b && b.y - (o.y + o.height)).toBeLessThan(120)
})

test('R-065 § 312i Eingabefehler vor dem Absenden erkennen und korrigieren: Fehlerzusammenfassung, „Ändern“-Links ohne Datenverlust, Übersicht übernimmt die Korrektur', async ({
  page,
  context,
  fixtureProducts,
}) => {
  const p = await keramik(fixtureProducts)
  await startCheckoutFor(context, page, [{ id: p.id }])
  await hydrated(page)
  await orderButton(page).click()
  const summary = page.locator('[data-error-summary]')
  await expect(summary).toBeVisible()
  await expect(summary.locator('[data-error-link]').first()).toBeVisible()
  await fillShipping(page, { email: 'tippfehler@planetclaire.lokal' })
  const overview = page.locator('#uebersicht')
  await expect(overview.locator('[data-overview-block="kontakt"]')).toContainText(
    'tippfehler@planetclaire.lokal',
  )
  await overview.locator('a[data-change="kontakt"]').click()
  await expect(page.locator('#checkout-email')).toBeFocused()
  await page.locator('#checkout-email').fill('richtig@planetclaire.local')
  await expect(overview.locator('[data-overview-block="kontakt"]')).toContainText(
    'richtig@planetclaire.local',
  )
  await expect(page.locator('#checkout-shipping-line1')).toHaveValue('Musterstraße 1')
  expect(page.url()).not.toMatch(/richtig|Musterstra|10115/)
})

test('R-012 § 312i Vertragsbestimmungen abrufbar und speicherbar: AGB, Widerrufsbelehrung und Datenschutz aus der Kasse als Dialog und Seite; AGB als PDF', async ({
  page,
  context,
  fixtureProducts,
}) => {
  const p = await keramik(fixtureProducts)
  await startCheckoutFor(context, page, [{ id: p.id }])
  await hydrated(page)
  const notice = page.locator('[data-legal-notice]')
  for (const type of ['agb', 'widerrufsbelehrung', 'datenschutz']) {
    await expect(notice.locator(`a[data-legal-dialog="${type}"]`)).toHaveCount(1)
  }
  await notice.locator('a[data-legal-dialog="agb"]').click()
  const dialog = page.locator('dialog[data-legal-dialog-panel="agb"]')
  await expect(dialog).toBeVisible()
  await dialog.locator('[data-dialog-close]').click()
  await expect(dialog).toBeHidden()
  const href = await notice.locator('a[data-legal-dialog="agb"]').getAttribute('href')
  await page.goto(href!)
  const pdf = page.locator('main [data-legal-pdf="agb"]')
  await expect(pdf).toBeVisible()
  const res = await page.request.get((await pdf.getAttribute('href'))!)
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toBe('application/pdf')
  expect(res.headers()['content-disposition'] ?? '').toMatch(/AGB/i)
})

test('R-081 R-013 AK-6-02 Zugangs- und Vertragsbestätigung: M01 kommt sofort nach der Zahlung mit Rechnung, AGB und Widerrufsbelehrung samt Muster-Formular (Bestellfassung); vorher keine Bestellung', async ({
  page,
  context,
  request,
  fixtureProducts,
}) => {
  const p = await keramik(fixtureProducts)
  const b = await buyer(context, page)
  await addToCartFromProduct(page, request, p.itemNumber)
  const token = await goToCheckout(context, page)
  await fillShipping(page, { email: b.email })
  await choosePayment(page, 'stripe')
  await chooseMock(page, 'success', 'card')
  expect(await ordersOf([p.id])).toEqual([])
  const thanks = await orderAndThank(page, token)
  await expect(thanks).toHaveAttribute('data-thanks-state', 'paid')
  await expect
    .poll(async () => (await readOutbox({ to: b.email, type: 'order_confirmation' })).length, {
      timeout: 15_000,
    })
    .toBe(1)
  const [m01] = await readOutbox({ to: b.email, type: 'order_confirmation' })
  const pdfs = m01!.attachments
    .filter((a) => a.contentType === 'application/pdf')
    .map((a) => a.filename)
  expect(pdfs).toHaveLength(3)
  expect(pdfs[0]).toMatch(/^(BSP-)?RE-\d{4}-\d{5}\.pdf$/)
  expect(pdfs[1]).toMatch(/^AGB_v\d+\.pdf$/)
  expect(pdfs[2]).toMatch(/^Widerrufsbelehrung-und-Formular_v\d+\.pdf$/)
  expect(m01!.text).toContain('Vertrag widerrufen')
})
