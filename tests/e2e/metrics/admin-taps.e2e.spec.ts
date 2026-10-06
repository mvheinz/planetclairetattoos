import { mkdirSync, writeFileSync } from 'node:fs'

import { createOrder, orderData } from '../../int/helpers/commerce'
import { adminPath, expect, test, testPayload } from '../fixtures'
import { orderStatus, packingPanelReady, removeOrder } from '../admin/orderHelpers'

// P10.2 Kennzahl EK-08 (automatischer Teil, KONZEPT §3) bei 390×844: „bezahlt → versendet“ in höchstens 5 Taps plus
// Eingabe der Sendungsnummer (AK-7-05) und AK-7-04 (Handy-Ansichten ohne waagerechtes Scrollen). Der Teil „Neues Stück
// bis online mit ≤ 10 Eingaben ohne Fotos“ zählt `tests/e2e/admin/new-piece.e2e.spec.ts` (EK-08). Die Stoppuhr-Prüfung
// „≤ 3 min“ gehört zu P11.9 (`tests/manual-checks.json`). Kennzahlen: `test-results/metrics/admin-taps.json`.

const MAX_TAPS = 5

test('EK-08 AK-7-05 AK-7-04 „bezahlt → versendet“ bei 390×844 in ≤ 5 Taps plus Sendungsnummer, ohne waagerechtes Scrollen', async ({
  adminPage: page,
  fixtureProducts,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const payload = await testPayload()
  const product = await fixtureProducts.create('textil', {
    status: 'available',
    firstPublishedAt: new Date(Date.now() - 86_400_000).toISOString(),
  })
  const created = await createOrder(
    payload,
    orderData(
      90_000 + product.itemNumber * 10 + 6,
      [{ id: product.id, itemNumber: product.itemNumber, shippingClass: 'paket_klein' }],
      {
        seed: true,
        shippingClass: 'paket_klein',
        timestamps: { placedAt: new Date().toISOString() },
      },
    ),
  )
  const order = { id: created.id as number, orderNumber: created.orderNumber as string }
  let taps = 0
  let typed = 0
  const overflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  try {
    await page.goto(adminPath('/packen'))
    expect(await overflow(), 'AK-7-04 /packen').toBeLessThanOrEqual(1)
    const card = page.locator(`[data-order-number="${order.orderNumber}"]`)
    taps += 1
    await card.getByRole('link', { name: order.orderNumber }).click()
    const panel = await packingPanelReady(page)
    expect(await overflow(), 'AK-7-04 Packansicht').toBeLessThanOrEqual(1)
    taps += 1
    await panel.getByTestId('mark-packed').click()
    await expect.poll(async () => (await orderStatus(payload, order.id)).status).toBe('packed')
    const form = page.getByTestId('ship-form')
    await form.getByLabel('Sendungsnummer').fill('00340 4343 1234 5678 91')
    typed += 1
    taps += 1
    await form.getByTestId('ship-order').click()
    const dialog = page.locator('dialog[open]')
    taps += 1
    await dialog.getByTestId('confirm-dialog-ok').click()
    await expect.poll(async () => (await orderStatus(payload, order.id)).status).toBe('shipped')
    expect(taps, 'EK-08 Taps „bezahlt → versendet“').toBeLessThanOrEqual(MAX_TAPS)
    expect(typed).toBe(1)

    mkdirSync('test-results/metrics', { recursive: true })
    writeFileSync(
      `test-results/metrics/admin-taps-${testInfo.project.name}.json`,
      JSON.stringify({ kennzahl: 'EK-08', taps, typed, maxTaps: MAX_TAPS }, null, 2),
    )
  } finally {
    await removeOrder(payload, order.id)
  }
})
