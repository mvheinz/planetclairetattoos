import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'

import { expectCalm } from '../calm'
import { expect, test, testPayload } from '../fixtures'
import {
  cleanup,
  fixtureOrder,
  forbiddenFindings,
  submittedCheckout,
  TOKEN_HEADERS,
} from './orderFixtures'

// P4.23 – Bestellstatus R09 (KONZEPT §4.12, DESIGN KO-16, DATENMODELL §6.8.2): Fixtures analog O01 (`refunded`), O03
// (`disputed` → Status davor), O10 (`shipped`) und O13 (`awaiting_prepayment`) mit `seed = true` („Beispiel“); Header,
// Maskierung, keine Straße, Link „Vertrag widerrufen“ mit `?order=`, nur Rechtstext-Dokumente (R-067), axe (`@a11y`).

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function expectAccessible(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  const blocking = result.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.help} – ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)
  expect(blocking).toEqual([])
}

const checkouts: number[] = []
test.afterEach(async () => {
  await cleanup(await testPayload(), checkouts.splice(0))
})

const SHIPPED = {
  shipment: { carrier: 'dhl', trackingNumber: '00340434161234567890' },
  packaging: {
    templateKey: 'keramik',
    templateName: 'Keramik',
    components: [{ material: 'paper_cardboard', grams: 180 }],
  },
}

async function statusPage(
  page: Page,
  fixtureProducts: {
    create: (c: 'keramik', o: Record<string, unknown>) => Promise<{ id: number }>
  },
  build: (checkoutId: number) => ReturnType<typeof fixtureOrder>,
) {
  const payload = await testPayload()
  const piece = await fixtureProducts.create('keramik', {
    status: 'available',
    firstPublishedAt: new Date(Date.now() - 86_400_000).toISOString(),
  })
  const c = await submittedCheckout(payload, [piece.id], { seed: true })
  checkouts.push(c.checkoutId)
  const { order, statusToken } = await build(c.checkoutId)
  const res = await page.goto(`/de/bestellung/${statusToken}`)
  expect(res?.status()).toBe(200)
  expect(res?.headers()).toMatchObject(TOKEN_HEADERS)
  return { order, statusToken, html: await page.content() }
}

async function expectCommon(page: Page, orderNumber: string, html: string) {
  await expect(page.getByRole('heading', { level: 1, name: 'Bestellstatus' })).toBeVisible()
  await expect(page.locator('[data-example-note]')).toContainText('Beispiel')
  await expect(page.locator('[data-order-number]')).toContainText(orderNumber)
  // Maskierung: Name, PLZ + Ort, maskierte E-Mail; keine Straße, keine volle E-Mail
  const customer = page.locator('[data-order-customer]')
  await expect(customer).toContainText('Erika Beispiel')
  await expect(customer).toContainText('10115 Berlin')
  await expect(page.locator('[data-masked-email]')).toHaveText('e•••@example.com')
  expect(html).not.toContain('Musterstraße')
  expect(html).not.toContain('erika.beispiel@example.com')
  // „Vertrag widerrufen“ → R26 mit ?order=<Bestellnummer> (nie die E-Mail)
  await expect(page.getByRole('link', { name: 'Vertrag widerrufen' }).first()).toBeVisible()
  await expect(page.locator(`a[href="/de/vertrag-widerrufen?order=${orderNumber}"]`)).toHaveCount(1)
  // R-067: nur AGB und Widerrufsbelehrung, keine Rechnung/Gutschrift
  const docs = page.locator('[data-order-document]')
  await expect(docs).toHaveCount(2)
  await expect(page.locator('a[href*="/documents/"]')).toHaveCount(2)
  await expect(page.locator('a[href*="RE-"], a[href*="GS-"], a[href*="invoice"]')).toHaveCount(0)
  await expect(page.getByText('Deine Rechnung hast du per Mail bekommen.')).toBeVisible()
  expect(page.url()).not.toMatch(/@|Erika/)
  expect(forbiddenFindings(html)).toEqual([])
  // genau ein aktueller Schritt
  await expect(page.locator('[data-order-status-line] [aria-current="step"]')).toHaveCount(1)
}

test('R-067 AK-4-12 Fixture analog O10 (versendet): Verlauf, Sendungsnummer mit Link, Dokumente laden @a11y', async ({
  page,
  request,
  fixtureProducts,
}) => {
  const payload = await testPayload()
  const { order, statusToken, html } = await statusPage(page, fixtureProducts, (id) =>
    fixtureOrder(payload, id, 'O1', [{ to: 'packed' }, { to: 'shipped', data: SHIPPED }]),
  )
  await expectCommon(page, order.orderNumber, html)
  await expect(page.locator('[data-order-status-line] [aria-current="step"]')).toHaveAttribute(
    'data-step',
    'shipped',
  )
  await expect(page.locator('[data-step="delivered"]')).toHaveAttribute('data-state', 'upcoming')
  await expect(page.locator('[data-tracking-number]')).toHaveText('00340434161234567890')
  await expect(page.locator('[data-tracking-link]')).toHaveAttribute(
    'href',
    /dhl\.de\/.*piececode=00340434161234567890/,
  )
  for (const href of await page
    .locator('[data-order-document]')
    .evaluateAll((as) => as.map((a) => a.getAttribute('href')!))) {
    const doc = await request.get(href)
    expect(doc.status(), href).toBe(200)
    expect(doc.headers()['content-type']).toBe('application/pdf')
    expect(doc.headers()['cache-control']).toBe('private, no-store')
  }
  const invoiceHref = `/api/orders/${statusToken}/documents/RE-2026-00001.pdf`
  expect((await request.get(invoiceHref)).status()).toBe(404)
  await expectCalm(page, 'R09')
  await expectAccessible(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await expectAccessible(page)
})

test('Fixture analog O13 (Vorkasse offen): Bankdaten, Frist, EPC-QR', async ({
  page,
  fixtureProducts,
}) => {
  const payload = await testPayload()
  const { order, html } = await statusPage(page, fixtureProducts, (id) =>
    fixtureOrder(payload, id, 'O2'),
  )
  await expectCommon(page, order.orderNumber, html)
  await expect(page.locator('[data-step="prepaymentReceived"]')).toHaveAttribute(
    'data-state',
    'upcoming',
  )
  const bank = page.locator('[data-bank-details]')
  await expect(bank.locator('[data-bank-iban]')).toHaveText('DE36 0000 0000 0000 0000 00')
  await expect(bank.locator('[data-bank-reference]')).toHaveText(order.orderNumber)
  await expect(bank.locator('[data-bank-due]')).toBeVisible()
  await expect(bank.locator('[data-epc-qr] img')).toBeVisible()
  await expectAccessible(page)
})

test('Fixture analog O01 (erstattet): Erstattung als eigener Eintrag, keine kommenden Schritte', async ({
  page,
  fixtureProducts,
}) => {
  const payload = await testPayload()
  const { order, html } = await statusPage(page, fixtureProducts, (id) =>
    fixtureOrder(payload, id, 'O19'),
  )
  await expectCommon(page, order.orderNumber, html)
  await expect(page.locator('[aria-current="step"]')).toHaveAttribute('data-step', 'refunded')
  await expect(page.locator('[data-state="upcoming"]')).toHaveCount(0)
  await expect(page.locator('[data-order-refunded]')).toBeVisible()
})

test('Fixture analog O03 (angefochten): die Kund:in sieht den Status aus statusBeforeDispute; anderer Token → 404', async ({
  page,
  fixtureProducts,
}) => {
  const payload = await testPayload()
  const { order, html } = await statusPage(page, fixtureProducts, (id) =>
    fixtureOrder(payload, id, 'O1', [
      { to: 'packed' },
      { to: 'shipped', data: SHIPPED },
      { to: 'delivered' },
      { to: 'disputed' },
    ]),
  )
  expect(order.status).toBe('disputed')
  expect(order.statusBeforeDispute).toBe('delivered')
  await expectCommon(page, order.orderNumber, html)
  await expect(page.locator('[data-order-status-page]')).toHaveAttribute(
    'data-order-status',
    'delivered',
  )
  await expect(page.locator('[aria-current="step"]')).toHaveAttribute('data-step', 'delivered')
  expect(html).not.toMatch(/angefochten|disputed/i)

  const other = await page.goto(`/de/bestellung/${'B'.repeat(43)}`)
  expect(other?.status()).toBe(404)
})

test('EN-Route und Sprachumschalter führen zur Token-Route der anderen Sprache', async ({
  page,
  fixtureProducts,
}) => {
  const payload = await testPayload()
  const { statusToken } = await statusPage(page, fixtureProducts, (id) =>
    fixtureOrder(payload, id, 'O1'),
  )
  await expect(
    page.locator(`a[hreflang="en"][href="/en/order/${statusToken}"]`).first(),
  ).toHaveCount(1)
  const res = await page.goto(`/en/order/${statusToken}`)
  expect(res?.headers()).toMatchObject(TOKEN_HEADERS)
  await expect(page.getByRole('heading', { level: 1, name: 'Order status' })).toBeVisible()
  await expect(page.locator('[data-example-note]')).toContainText('Example')
  await expect(
    page.getByRole('link', { name: 'Withdraw from contract here' }).first(),
  ).toBeVisible()
})
