import { expect, test, type Page } from '@playwright/test'
import type { Payload } from 'payload'

import { localizedPath } from '../../src/lib/routes/paths'
import { productByNumber, setCart } from '../e2e/cart/cartHelpers'
import { cleanupCheckouts, startCheckoutFor } from '../e2e/checkout/checkoutHelpers'
import { testPayload } from '../e2e/fixtures'
import { cleanup, fixtureOrder, submittedCheckout } from '../e2e/order/orderFixtures'
import { completeProduct, createProductFixtures } from '../int/helpers/products'
import { dynamicMasks, linuxOnly, loadAllImages, prepare, settle } from './helpers'

// T-12 Seiten der Phase P4 (ARCHITEKTUR §7.6, PLAN P4.25): Korb R06 (Seed-Anker S01 + S11), Kasse R07 (Fixture-Korb
// analog S01 + S11, offene Kasse), Danke R08 (bezahlt) und Bestellstatus R09 (versendet) – ganzseitig, DE, je Projekt
// `desktop` und `mobile`, reduzierte Bewegung. Server-Zeit und laufende Nummern lassen sich nicht festhalten:
// Countdown, Bestellnummer, Datumsangaben und Zahlungsfristen sind maskiert. Fixture-Nummern je Projekt eigene
// (desktop 980–983, mobile 986–989), danach entfernt.

const NUMBERS: Record<string, [number, number, number, number]> = {
  desktop: [980, 981, 982, 983],
  mobile: [986, 987, 988, 989],
}

const SHIPPED = {
  shipment: { carrier: 'dhl', trackingNumber: '00340434161234567890' },
  packaging: {
    templateKey: 'keramik',
    templateName: 'Keramik',
    components: [{ material: 'paper_cardboard', grams: 180 }],
  },
}

/** Stellen, die von der Server-Uhr oder laufenden Nummern abhängen. */
const masks = (page: Page) => [
  ...dynamicMasks(page),
  page.locator('[data-countdown-time]'),
  page.locator('[data-overview-deadline], [data-prepayment-due], [data-bank-due]'),
  page.locator('[data-thanks-order-number] span, [data-order-number] span'),
  page.locator('[data-order-number] + p'),
  page.locator('[data-order-status-line] [class*="stepDate"]'),
]

async function shoot(page: Page, name: string, path: string) {
  const res = await page.goto(path)
  expect(res?.status(), path).toBe(200)
  await loadAllImages(page)
  await settle(page)
  await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true, mask: masks(page) })
}

let payload: Payload
let numbers: [number, number, number, number]
const productIds: number[] = []
const checkoutIds: number[] = []

async function removeFixtures() {
  await cleanup(payload, checkoutIds.splice(0))
  await cleanupCheckouts(productIds.splice(0))
  await payload.delete({
    collection: 'products',
    where: { itemNumber: { in: numbers } },
    overrideAccess: true,
    context: { seed: true },
  })
}

async function piece(category: 'keramik' | 'textil', itemNumber: number, extra = {}) {
  const fx = await createProductFixtures(payload)
  const doc = await payload.create({
    collection: 'products',
    data: {
      ...completeProduct(category, itemNumber, fx),
      seed: true,
      status: 'available',
      firstPublishedAt: '2026-09-01T10:00:00.000Z',
      ...extra,
    } as never,
    overrideAccess: true,
    context: { seed: true },
  })
  productIds.push(doc.id as number)
  return doc.id as number
}

test.beforeEach(async ({ page }, testInfo) => {
  linuxOnly()
  await prepare(page)
  payload = await testPayload()
  numbers = NUMBERS[testInfo.project.name] ?? NUMBERS.desktop!
  await removeFixtures()
})
test.afterEach(async () => {
  await removeFixtures()
})

test('r06-korb (S01 + S11)', async ({ page, context }) => {
  const s01 = await productByNumber(901)
  const s11 = await productByNumber(911)
  await setCart(context, [
    { id: s01.id, p: s01.priceCents },
    { id: s11.id, p: s11.priceCents },
  ])
  await shoot(page, 'r06-korb', localizedPath('R06', 'de'))
})

test('r07-kasse (Fixture-Korb analog S01 + S11)', async ({ page, context }) => {
  const keramik = await piece('keramik', numbers[0], { priceCents: 4500 })
  const textil = await piece('textil', numbers[1], {
    priceCents: 6400,
    deviationDecision: 'described',
    hasDeviation: true,
    deviationDescription: 'Gestopfter Fleck an der linken Seitennaht',
  })
  await startCheckoutFor(context, page, [{ id: keramik }, { id: textil }])
  await shoot(page, 'r07-kasse', localizedPath('R07', 'de'))
})

test('r08-danke-bezahlt', async ({ page }) => {
  const id = await piece('keramik', numbers[2], { priceCents: 4500 })
  const c = await submittedCheckout(payload, [id], { seed: true })
  checkoutIds.push(c.checkoutId)
  await fixtureOrder(payload, c.checkoutId, 'O1')
  await shoot(page, 'r08-danke-bezahlt', localizedPath('R08', 'de', { token: c.token }))
})

test('r09-status-versendet', async ({ page }) => {
  const id = await piece('keramik', numbers[3], { priceCents: 4500 })
  const c = await submittedCheckout(payload, [id], { seed: true })
  checkoutIds.push(c.checkoutId)
  const { statusToken } = await fixtureOrder(payload, c.checkoutId, 'O1', [
    { to: 'packed' },
    { to: 'shipped', data: SHIPPED },
  ])
  await shoot(page, 'r09-status-versendet', localizedPath('R09', 'de', { token: statusToken }))
})
