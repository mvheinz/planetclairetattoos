import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'

import { CART_COOKIE } from '../../../src/lib/commerce/cartCookie'
import { CHECKOUT_COOKIE } from '../../../src/lib/commerce/checkout'
import { serverURL } from '../../helpers/adminEnv'
import { expect, test, testPayload } from '../fixtures'
import {
  cleanup,
  fixtureOrder,
  forbiddenFindings,
  mockPayments,
  submittedCheckout,
  TOKEN_HEADERS,
} from '../order/orderFixtures'

// P4.17 – Danke-Seite R08 (KONZEPT §4.12, DESIGN KO-19): Zustände „wartet“ → „bezahlt“ (S10, Rückfall über
// `getCheckoutSession`), „nicht bezahlt“ (S9), „Vorkasse“ (Fixture analog O13) und „leider schon weg“ (O19), bezahlt EN
// (Fixture analog O14); Header R-066, Cookies gelöscht, Status-Link öffnet R09, Sprachumschalter, axe (`@a11y`).

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

test('R-066 AK-4-12 S10 „wartet“ → „bezahlt“ nach der nächsten Abfrage; Cookies gelöscht, Status-Link öffnet R09 @a11y', async ({
  page,
  fixtureProducts,
}) => {
  const payload = await testPayload()
  const piece = await fixtureProducts.create('keramik', {
    status: 'available',
    firstPublishedAt: new Date(Date.now() - 86_400_000).toISOString(),
  })
  const c = await submittedCheckout(payload, [piece.id], { confirming: true })
  checkouts.push(c.checkoutId)
  const mock = mockPayments()
  await mock.setNextOutcome(c.session!, { result: 'delayed' })
  await mock.emit(c.session!, 'checkout.session.completed')
  await page.context().addCookies([
    { name: CART_COOKIE, value: 'eyJ2IjoxLCJpdGVtcyI6W119', url: serverURL },
    { name: CHECKOUT_COOKIE, value: c.token, url: serverURL, httpOnly: true },
  ])

  const url = `/de/danke/${c.token}`
  const res = await page.goto(url)
  expect(res?.status()).toBe(200)
  expect(res?.headers()).toMatchObject(TOKEN_HEADERS)
  expect(page.url()).not.toMatch(/@|jutta|Erika/i)
  const root = page.locator('[data-thanks-page]')
  await expect(root).toHaveAttribute('data-thanks-state', 'waiting')
  await expect(page.getByText('Wir warten noch kurz auf die Bestätigung')).toBeVisible()
  await expectAccessible(page)

  // Testhilfe: Mock-Zustand der Session auf bezahlt → nächste Abfrage (2 s) → neu laden → „bezahlt“
  await mock.emit(c.session!, 'checkout.session.async_payment_succeeded')
  await expect(root).toHaveAttribute('data-thanks-state', 'paid', { timeout: 15_000 })
  await expect(page.getByRole('heading', { level: 1, name: 'Danke!' })).toBeVisible()
  await expect(page.getByText('Deine Bestellung ist eingegangen.')).toBeVisible()
  await expect(page.locator('[data-thanks-order-number]')).toContainText(/PC-\d{4}-\d{5}/)
  await expect(page.locator('[data-order-item]')).toHaveCount(1)
  await expect(page.locator('[data-price-tag="mini"]')).toHaveCount(1)
  await expect(page.getByText('Ich packe dein Paket')).toBeVisible()
  const withdraw = page.getByRole('link', { name: 'Vertrag widerrufen' }).first()
  await expect(withdraw).toHaveAttribute('href', /\/de\/vertrag-widerrufen\?order=PC-\d{4}-\d{5}/)
  await expectAccessible(page)
  expect(forbiddenFindings(await page.content())).toEqual([])

  // Beide Cookies sind gelöscht; erneuter Aufruf zeigt weiter „bezahlt“
  await expect
    .poll(async () => (await page.context().cookies()).map((k) => k.name).sort())
    .not.toContain(CHECKOUT_COOKIE)
  const names = (await page.context().cookies()).map((k) => k.name)
  expect(names).not.toContain(CART_COOKIE)
  await page.reload()
  await expect(root).toHaveAttribute('data-thanks-state', 'paid')

  // Status-Link öffnet R09
  await page.getByRole('link', { name: 'Bestellstatus ansehen' }).click()
  await expect(page).toHaveURL(/\/de\/bestellung\/[A-Za-z0-9_-]{43}$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Bestellstatus' })).toBeVisible()
})

test('S9 „nicht bezahlt“ (Abbruch): „Zurück zur Kasse“ führt in die weiterlaufende Kasse', async ({
  page,
  fixtureProducts,
}) => {
  const payload = await testPayload()
  const piece = await fixtureProducts.create('keramik', {
    status: 'available',
    firstPublishedAt: new Date(Date.now() - 86_400_000).toISOString(),
  })
  const c = await submittedCheckout(payload, [piece.id], { confirming: true })
  checkouts.push(c.checkoutId)
  const res = await page.goto(`/de/danke/${c.token}`)
  expect(res?.headers()).toMatchObject(TOKEN_HEADERS)
  await expect(page.locator('[data-thanks-page]')).toHaveAttribute('data-thanks-state', 'unpaid')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Die Zahlung hat nicht geklappt' }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Zurück zur Kasse' })).toHaveAttribute(
    'href',
    '/de/kasse',
  )
  const checkout = await payload.findByID({
    collection: 'checkouts',
    id: c.checkoutId,
    depth: 0,
    overrideAccess: true,
  })
  expect(checkout.status).toBe('open')
  await expectAccessible(page)
})

test('Fixture analog O13: Vorkasse mit Bankdaten, Frist, EPC-QR (168 px), „Beispiel“; Kopier-Knöpfe @a11y', async ({
  page,
  fixtureProducts,
}) => {
  const payload = await testPayload()
  const piece = await fixtureProducts.create('keramik', {
    status: 'available',
    firstPublishedAt: new Date(Date.now() - 86_400_000).toISOString(),
  })
  const c = await submittedCheckout(payload, [piece.id], { seed: true })
  checkouts.push(c.checkoutId)
  const { order } = await fixtureOrder(payload, c.checkoutId, 'O2')
  expect(order.seed).toBe(true)
  await page.goto(`/de/danke/${c.token}`)
  await expect(page.locator('[data-thanks-page]')).toHaveAttribute(
    'data-thanks-state',
    'prepayment',
  )
  await expect(page.locator('[data-example-note]')).toContainText('Beispiel')
  await expect(page.getByRole('heading', { level: 1, name: 'Danke!' })).toBeVisible()
  const bank = page.locator('[data-bank-details]')
  await expect(bank.locator('[data-bank-iban]')).toHaveText('DE36 0000 0000 0000 0000 00')
  await expect(bank.locator('[data-bank-reference]')).toHaveText(order.orderNumber)
  await expect(bank.locator('[data-bank-due]')).toContainText('Bitte überweise bis')
  const qr = bank.locator('[data-epc-qr] img')
  await expect(qr).toHaveAttribute('src', /^data:image\/svg\+xml;base64,/)
  expect(await qr.evaluate((img) => (img as HTMLImageElement).getBoundingClientRect().width)).toBe(
    168,
  )
  await expect(page.locator('[data-sold-stamp]')).toHaveCount(0)
  const copy = page.getByRole('button', { name: 'IBAN kopieren' })
  await expect(copy).toBeVisible()
  await expect(page.getByRole('button', { name: 'Verwendungszweck kopieren' })).toBeVisible()
  await expectAccessible(page)
  expect(forbiddenFindings(await page.content())).toEqual([])
})

test('O19 „leider schon weg“: H1, Text wie M10, Link zum Shop; keine Bankdaten, keine Rechnung', async ({
  page,
  fixtureProducts,
}) => {
  const payload = await testPayload()
  const piece = await fixtureProducts.create('keramik', {
    status: 'available',
    firstPublishedAt: new Date(Date.now() - 86_400_000).toISOString(),
  })
  const c = await submittedCheckout(payload, [piece.id], { confirming: true })
  checkouts.push(c.checkoutId)
  const { order } = await fixtureOrder(payload, c.checkoutId, 'O19')
  expect(order.status).toBe('refunded')
  await page.goto(`/de/danke/${c.token}`)
  await expect(page.locator('[data-thanks-page]')).toHaveAttribute('data-thanks-state', 'gone')
  await expect(page.getByRole('heading', { level: 1, name: 'Leider schon weg' })).toBeVisible()
  await expect(page.getByText('Jemand war ein paar Sekunden schneller')).toBeVisible()
  await expect(page.getByText('5–10 Werktage')).toBeVisible()
  await expect(page.locator('[data-thanks-order-number]')).toContainText(order.orderNumber)
  await expect(page.getByRole('link', { name: 'Zum Shop' })).toHaveAttribute('href', '/de/shop')
  await expect(page.locator('[data-bank-details]')).toHaveCount(0)
  await expect(page.getByText(/Rechnung|Rabatt/)).toHaveCount(0)
  await expectAccessible(page)
})

test('Fixture analog O14 (EN, bezahlt): „Thank you!“, „Example“; Sprachumschalter führt zur Token-Route der anderen Sprache', async ({
  page,
  fixtureProducts,
}) => {
  const payload = await testPayload()
  const piece = await fixtureProducts.create('keramik', {
    status: 'available',
    firstPublishedAt: new Date(Date.now() - 86_400_000).toISOString(),
  })
  const c = await submittedCheckout(payload, [piece.id], { locale: 'en', seed: true })
  checkouts.push(c.checkoutId)
  await fixtureOrder(payload, c.checkoutId, 'O1')
  const res = await page.goto(`/en/thank-you/${c.token}`)
  expect(res?.headers()).toMatchObject(TOKEN_HEADERS)
  await expect(page.locator('[data-thanks-page]')).toHaveAttribute('data-thanks-state', 'paid')
  await expect(page.getByRole('heading', { level: 1, name: 'Thank you!' })).toBeVisible()
  await expect(page.locator('[data-example-note]')).toContainText('Example')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  const de = page.locator(`a[hreflang="de"][href="/de/danke/${c.token}"]`).first()
  await expect(de).toHaveCount(1)
})

test('unbekannter Token → 404; Token-Endpunkt ohne Personendaten', async ({ page, request }) => {
  const res = await page.goto(`/de/danke/${'A'.repeat(43)}`)
  expect(res?.status()).toBe(404)
  const api = await request.get(`/api/checkout/${'A'.repeat(43)}/state`)
  expect(api.status()).toBe(404)
  expect(api.headers()['cache-control']).toBe('private, no-store')
})
