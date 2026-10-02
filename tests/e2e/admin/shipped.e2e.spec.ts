import type { Payload } from 'payload'

import { createOrder, orderData } from '../../int/helpers/commerce'
import { adminPath, expect, test, testPayload } from '../fixtures'
import {
  expectAccessible,
  expectNoHorizontalScroll,
  orderStatus,
  removeOrder,
} from './orderHelpers'

// P5.16 – „Versendet“ `/versendet` (KONZEPT §7.8): versendete Bestellungen mit Versanddatum, Sendungsnummer als Link,
// Status; „Sendungsnummer korrigieren“ mit Rückfrage „Versandmail erneut senden?“ („Nein“ → keine Mail, „Ja“ → genau
// eine), „Zugestellt“ (O10). Handy 390 px ohne horizontales Scrollen, axe.

const mails = async (payload: Payload, orderId: number) =>
  (
    await payload.count({
      collection: 'email-log',
      where: {
        and: [{ order: { equals: orderId } }, { template: { equals: 'order_shipped' } }],
      },
      overrideAccess: true,
    })
  ).totalDocs

test('@a11y „Versendet“: Liste, Sendungsnummer korrigieren (nein/ja), Zugestellt', async ({
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
      90_000 + product.itemNumber * 10 + 7,
      [{ id: product.id, itemNumber: product.itemNumber, shippingClass: 'paket_klein' }],
      {
        seed: true,
        status: 'shipped',
        shippingClass: 'paket_klein',
        shipment: {
          carrier: 'dhl',
          trackingNumber: 'JJD000390007123456',
          trackingUrl:
            'https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=JJD000390007123456',
        },
        timestamps: {
          placedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
          shippedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
        },
      },
    ),
    { seed: true },
  )
  const order = { id: created.id as number, orderNumber: created.orderNumber as string }
  try {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(adminPath('/versendet'))
    const card = page.locator(`[data-order-number="${order.orderNumber}"]`)
    await expect(card).toContainText('Versendet am')
    await expect(card.getByTestId('shipped-tracking').getByRole('link')).toHaveAttribute(
      'href',
      /piececode=JJD000390007123456/,
    )
    await expect(card.getByTestId('complaint-link')).toHaveAttribute(
      'href',
      new RegExp(`/bestellungen/${order.id}#order-complaints$`),
    )
    await expectNoHorizontalScroll(page)
    await expectAccessible(page, '[data-testid="shipped-list"]')

    // korrigieren, „Nein“ → keine Mail
    await card.getByTestId('fix-tracking').click()
    await card.getByLabel('Sendungsnummer').fill('00340 4343 1234 5678 90')
    await card.getByTestId('fix-tracking-save').click()
    const dialog = page.locator('dialog[open]')
    await expect(dialog).toContainText('Versandmail erneut senden?')
    await expectAccessible(page, 'dialog[open]')
    await dialog.getByTestId('fix-tracking-no-mail').click()
    await expect(card.getByTestId('shipped-tracking')).toContainText('0034043431234567890')
    expect(await mails(payload, order.id)).toBe(0)

    // nochmal korrigieren, „Ja“ → genau eine Mail
    await card.getByTestId('fix-tracking').click()
    await card.getByLabel('Sendungsnummer').fill('JJD000390007654321')
    await card.getByTestId('fix-tracking-save').click()
    await page.locator('dialog[open]').getByTestId('confirm-dialog-ok').dblclick()
    await expect(card.getByTestId('shipped-tracking')).toContainText('JJD000390007654321')
    await expect.poll(() => mails(payload, order.id)).toBe(1)

    await card.getByTestId('mark-delivered').click()
    await expect.poll(async () => (await orderStatus(payload, order.id)).status).toBe('delivered')
    await expect(card).toHaveAttribute('data-status', 'delivered')
    expect(await mails(payload, order.id)).toBe(1)
  } finally {
    await removeOrder(payload, order.id)
  }
})
