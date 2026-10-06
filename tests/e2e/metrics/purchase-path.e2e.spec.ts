import { mkdirSync, writeFileSync } from 'node:fs'

import { holdShippingRates, type ReleaseLock } from '../../helpers/adminSessionLock'
import { cleanupCheckouts } from '../checkout/checkoutHelpers'
import { expect, test } from '../fixtures'
import { PUBLISHED } from '../shop/productPage'
import {
  addToCartFromProduct,
  buyer,
  chooseMock,
  choosePayment,
  choosePickup,
  distinctPages,
  fillShipping,
  goToCheckout,
  orderAndThank,
  ordersOf,
} from '../purchase/purchaseHelpers'

// P10.2 Kaufpfad-Kennzahl EK-02 (KONZEPT §3 Tabelle „Erfolgskriterien“): Produktlink → Warenkorb → Kasse → Danke in
// höchstens 4 Seiten für Karte, PayPal, Vorkasse und Abholung bei 390×844 und 412×915. Die Zähl-Assertions stehen
// hier gebündelt; die Inhaltsprüfungen (Mails, Zahlstatus, CSP) liefern `tests/e2e/purchase/*`. Läuft auf `iphone-15`
// und `pixel-7` (Projekt `desktop` ignoriert `purchase/` und `metrics/purchase-path`, playwright.config.ts).
// Jeder Lauf schreibt seine Kennzahlen nach `test-results/metrics/purchase-path.json` (Bericht im CI-Artefakt).

const MAX_PAGES = 4
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 412, height: 915 },
] as const
const PATHS = [
  { id: 'card', label: 'Karte', delivery: 'shipping', payment: 'stripe', mock: 'card' },
  { id: 'paypal', label: 'PayPal', delivery: 'shipping', payment: 'stripe', mock: 'paypal' },
  { id: 'prepayment', label: 'Vorkasse', delivery: 'shipping', payment: 'prepayment', mock: null },
  { id: 'pickup', label: 'Abholung', delivery: 'pickup', payment: 'stripe', mock: 'card' },
] as const

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

for (const vp of VIEWPORTS) {
  for (const path of PATHS) {
    test(`EK-02 Kennzahl ${path.label} bei ${vp.width}×${vp.height}: Produkt → Warenkorb → Kasse → Danke in ≤ ${MAX_PAGES} Seiten`, async ({
      page,
      context,
      request,
      fixtureProducts,
    }, testInfo) => {
      await page.setViewportSize(vp)
      const p = await fixtureProducts.create('keramik', { ...PUBLISHED, priceCents: 4500 })
      used.push(p.id)
      const b = await buyer(context, page)
      await addToCartFromProduct(page, request, p.itemNumber)
      const token = await goToCheckout(context, page)
      if (path.delivery === 'pickup') await choosePickup(page, b.email)
      else await fillShipping(page, b.email)
      await choosePayment(page, path.payment)
      if (path.mock) await chooseMock(page, 'success', path.mock)
      const thanks = await orderAndThank(page, token)
      await expect(thanks).toHaveAttribute(
        'data-thanks-state',
        path.payment === 'prepayment' ? 'prepayment' : 'paid',
      )

      const pages = distinctPages(b)
      expect(pages, 'EK-02 Seitenfolge').toHaveLength(MAX_PAGES)
      expect(pages.length).toBeLessThanOrEqual(MAX_PAGES)
      expect(await ordersOf([p.id])).toHaveLength(1)
      expect(b.errors, 'Konsolenfehler').toEqual([])

      const dir = 'test-results/metrics'
      mkdirSync(dir, { recursive: true })
      writeFileSync(
        `${dir}/purchase-path-${testInfo.project.name}-${path.id}-${vp.width}x${vp.height}.json`,
        JSON.stringify(
          { kennzahl: 'EK-02', path: path.id, viewport: vp, pages, max: MAX_PAGES },
          null,
          2,
        ),
      )
    })
  }
}
