import { adminPath, expect, test, testPayload } from '../fixtures'
import { createOrder, orderData } from '../../int/helpers/commerce'
import { expectAccessible, orderStatus, packingPanelReady, removeOrder } from './orderHelpers'

// P5.15 – AK-7-05: Bestellung analog O14 (`paid`, Versand, ohne Keramik) → „Gepackt“ (Verpackung aus der Vorlage) →
// Sendungsnummer eingeben → „Versendet melden“ → Status `shipped`, M06 im Mail-Log – in höchstens 5 Taps plus
// Texteingabe (EK-08). Doppeltipp auf „Bestätigen“ → eine Mail. Dialog nennt die Folge („… mit Sendungsnummer.“).

test('@a11y AK-7-05 „Gepackt“ → Sendungsnummer → „Versendet melden“: shipped und M06 in ≤ 5 Taps', async ({
  adminPage: page,
  fixtureProducts,
}) => {
  const payload = await testPayload()
  const product = await fixtureProducts.create('textil', {
    status: 'available',
    firstPublishedAt: new Date(Date.now() - 86_400_000).toISOString(),
  })
  const created = await createOrder(
    payload,
    orderData(
      90_000 + product.itemNumber * 10 + 5,
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
  const tap = async (fn: () => Promise<void>) => {
    taps += 1
    await fn()
  }
  try {
    await page.goto(adminPath('/packen'))
    const card = page.locator(`[data-order-number="${order.orderNumber}"]`)
    await tap(() => card.getByRole('link', { name: order.orderNumber }).click())
    const panel = await packingPanelReady(page)
    await tap(() => panel.getByTestId('mark-packed').click())
    await expect.poll(async () => (await orderStatus(payload, order.id)).status).toBe('packed')

    const form = page.getByTestId('ship-form')
    await expect(form.getByLabel('Versanddienst')).toHaveValue('dhl')
    await form.getByLabel('Sendungsnummer').fill('00340 4343 1234 5678 90')
    await tap(() => form.getByTestId('ship-order').click())
    const dialog = page.locator('dialog[open]')
    await expect(dialog).toContainText('Die Kundin bekommt eine Versandmail mit Sendungsnummer.')
    await expectAccessible(page, 'dialog[open]')
    await tap(() => dialog.getByTestId('confirm-dialog-ok').dblclick())
    await expect.poll(async () => (await orderStatus(payload, order.id)).status).toBe('shipped')
    expect(taps).toBeLessThanOrEqual(5)

    const logs = await payload.find({
      collection: 'email-log',
      where: {
        and: [{ order: { equals: order.id } }, { template: { equals: 'order_shipped' } }],
      },
      overrideAccess: true,
      depth: 0,
    })
    expect(logs.docs).toHaveLength(1)
    expect(logs.docs[0]!.idempotencyKey).toBe(`order_shipped:${order.id}:0034043431234567890`)
    const shipped = (await payload.findByID({
      collection: 'orders',
      id: order.id,
      depth: 0,
      overrideAccess: true,
    })) as { shipment?: { trackingNumber?: string | null } | null }
    expect(shipped.shipment?.trackingNumber).toBe('0034043431234567890')
  } finally {
    await removeOrder(payload, order.id)
  }
})
