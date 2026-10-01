import type { Payload } from 'payload'

import { createOrder, orderData } from '../../int/helpers/commerce'
import { adminPath, expect, test, testPayload } from '../fixtures'
import {
  expectAccessible,
  expectNoHorizontalScroll,
  orderStatus,
  removeOrder,
} from './orderHelpers'

// P5.17 – „Abholung“ `/abholung` (KONZEPT §7.9): bezahlte Abholbestellung → Textfeld vorbelegt (Abholtext + Adresse),
// editierbar → „Bereit zur Abholung“ (Dialog nennt die Mail) → `ready_for_pickup`, M07 im Mail-Log, Text gespeichert;
// Fixture analog O09 mit Wartetagen (> 14 markiert); „Abgeholt“ → `picked_up`. Handy 390 px, axe.

const pickupData = (placedAt: string) => ({
  seed: true,
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
  timestamps: { placedAt, paidAt: placedAt },
})

const m07 = async (payload: Payload, orderId: number) =>
  (
    await payload.count({
      collection: 'email-log',
      where: {
        and: [{ order: { equals: orderId } }, { template: { equals: 'pickup_ready' } }],
      },
      overrideAccess: true,
    })
  ).totalDocs

test('@a11y „Abholung“: Bereit zur Abholung mit Abholtext (M07), Wartetage, Abgeholt', async ({
  adminPage: page,
  fixtureProducts,
}) => {
  const payload = await testPayload()
  const live = {
    status: 'available',
    firstPublishedAt: new Date(Date.now() - 86_400_000).toISOString(),
  }
  const a = await fixtureProducts.create('keramik', live)
  const b = await fixtureProducts.create('keramik', live)
  const now = Date.now()
  const paid = await createOrder(
    payload,
    orderData(
      90_000 + a.itemNumber * 10 + 8,
      [{ id: a.id, itemNumber: a.itemNumber }],
      pickupData(new Date(now - 86_400_000).toISOString()),
    ),
  )
  const waiting = await createOrder(
    payload,
    orderData(90_000 + b.itemNumber * 10 + 8, [{ id: b.id, itemNumber: b.itemNumber }], {
      ...pickupData(new Date(now - 20 * 86_400_000).toISOString()),
      status: 'ready_for_pickup',
      pickup: { messageText: 'Abholung nach Absprache.' },
      timestamps: {
        placedAt: new Date(now - 20 * 86_400_000).toISOString(),
        paidAt: new Date(now - 20 * 86_400_000).toISOString(),
        readyForPickupAt: new Date(now - 16 * 86_400_000).toISOString(),
      },
    }),
    { seed: true },
  )
  const ids = [paid.id as number, waiting.id as number]
  try {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(adminPath('/abholung'))
    const old = page.locator(`[data-order-number="${waiting.orderNumber}"]`)
    await expect(old).toHaveAttribute('data-overdue', 'true')
    await expect(old.getByTestId('pickup-waiting')).toContainText('16 Tagen')
    const card = page.locator(`[data-order-number="${paid.orderNumber}"]`)
    const text = card.getByTestId('pickup-text')
    await expect(text).toHaveValue(/Abholung in Berlin nach Absprache/)
    await expectNoHorizontalScroll(page)
    await expectAccessible(page, '[data-testid="pickup-list"]')

    const confirmed = `${await text.inputValue()}\nMöglich: Di und Do 16–19 Uhr.`
    await text.fill(confirmed)
    await card.getByTestId('mark-ready').click()
    const dialog = page.locator('dialog[open]')
    await expect(dialog).toContainText('Die Kundin bekommt eine Mail')
    await dialog.getByTestId('confirm-dialog-ok').click()
    await expect
      .poll(async () => (await orderStatus(payload, paid.id as number)).status)
      .toBe('ready_for_pickup')
    expect(await m07(payload, paid.id as number)).toBe(1)
    const saved = (await payload.findByID({
      collection: 'orders',
      id: paid.id,
      depth: 0,
      overrideAccess: true,
    })) as { pickup?: { messageText?: string | null } | null }
    expect(saved.pickup?.messageText).toBe(confirmed)

    await expect(card).toHaveAttribute('data-status', 'ready_for_pickup')
    await card.getByTestId('mark-picked-up').click()
    await page.locator('dialog[open]').getByTestId('confirm-dialog-ok').click()
    await expect
      .poll(async () => (await orderStatus(payload, paid.id as number)).status)
      .toBe('picked_up')
  } finally {
    for (const id of ids) await removeOrder(payload, id)
  }
})
