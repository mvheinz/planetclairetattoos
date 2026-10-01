import { adminPath, expect, test, testPayload } from '../fixtures'
import {
  expectAccessible,
  expectNoHorizontalScroll,
  fixtureOrder,
  orderStatus,
  removeOrder,
} from './orderHelpers'

// P5.10 – „Zu packen“ `/packen`: genau die Versandbestellungen `paid` (analog O14) und `packed` (analog O12), älteste
// zuerst – ohne Abholung und `shipped`; Hinweise wörtlich; „Adresse kopieren“ (ohne Einwilligung keine E-Mail, R-101);
// „Gepackt“ zweimal getippt → ein Statuswechsel. Handy 390×844 ohne horizontales Scrollen, axe.

test('@a11y „Zu packen“: Liste, Hinweise, Adresse kopieren, Gepackt (Doppeltipp → ein Statuswechsel)', async ({
  adminPage: page,
  fixtureProducts,
  context,
  browserName,
}) => {
  const payload = await testPayload()
  const live = {
    status: 'available',
    firstPublishedAt: new Date(Date.now() - 86_400_000).toISOString(),
  }
  const [p1, p2, p3, p4] = [
    await fixtureProducts.create('keramik', live),
    await fixtureProducts.create('keramik', live),
    await fixtureProducts.create('keramik', live),
    await fixtureProducts.create('keramik', live),
  ]
  const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()
  const n = (p: { itemNumber: number }) => 90_000 + p.itemNumber * 10 + 2
  const paid = await fixtureOrder(payload, p1!, n(p1!), { timestamps: { placedAt: ago(2) } })
  const packed = await fixtureOrder(
    payload,
    p2!,
    n(p2!),
    { status: 'packed', timestamps: { placedAt: ago(5) } },
    { seed: true },
  )
  const pickup = await fixtureOrder(payload, p3!, n(p3!), {
    fulfillmentMethod: 'pickup',
    shippingAddress: undefined,
    shippingZone: undefined,
    shippingClass: undefined,
    shippingCents: 0,
    totalCents: 4500,
    billingAddress: {
      name: 'Erika Beispiel',
      addressLine1: 'Musterstraße 1',
      postalCode: '10115',
      city: 'Berlin',
      country: 'DE',
    },
    timestamps: { placedAt: ago(8) },
  })
  const shipped = await fixtureOrder(
    payload,
    p4!,
    n(p4!),
    { status: 'shipped', timestamps: { placedAt: ago(9), shippedAt: ago(1) } },
    { seed: true },
  )
  const mine = [paid, packed, pickup, shipped].map((o) => o.orderNumber)
  try {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(adminPath('/packen'))
    const cards = page.getByTestId('packing-card')
    const listed = (await cards.evaluateAll((els) =>
      els.map((e) => e.getAttribute('data-order-number')),
    )) as string[]
    expect(listed.filter((nr) => mine.includes(nr))).toEqual([packed.orderNumber, paid.orderNumber])
    const card = page.locator(`[data-order-number="${paid.orderNumber}"]`)
    await expect(card).toContainText(`Nr. ${p1!.itemNumber}`)
    await expect(card).toContainText('Erika Beispiel, Berlin')
    await expect(card.getByTestId('packing-hints')).toContainText('Keramik – Karton in Karton')
    await expect(card.getByTestId('packing-hints')).toContainText('E-Mail an DHL: nein')
    await expectNoHorizontalScroll(page)
    await expectAccessible(page, '[data-testid="packing-list"]')

    if (browserName === 'chromium') {
      await context.grantPermissions(['clipboard-read', 'clipboard-write'])
      await card.getByTestId('copy-address').getByRole('button').click()
      await expect(card.getByTestId('copy-address')).toContainText('Kopiert.')
      const text = await page.evaluate(() => navigator.clipboard.readText())
      expect(text).toBe('Erika Beispiel\nMusterstraße 1\n10115 Berlin')
    }
    await expect(card.getByTestId('copy-line')).toHaveCount(3)

    await card.getByTestId('mark-packed').dblclick()
    await expect(card.getByText('Erledigt.')).toBeVisible()
    await expect.poll(async () => (await orderStatus(payload, paid.id)).status).toBe('packed')
    const history = (await orderStatus(payload, paid.id)).statusHistory ?? []
    expect(history.filter((h) => h.transition === 'O6')).toHaveLength(1)
  } finally {
    for (const o of [paid, packed, pickup, shipped]) await removeOrder(payload, o.id)
  }
})
