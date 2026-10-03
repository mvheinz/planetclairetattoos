import { sql } from '@payloadcms/db-postgres'

import { createOrder, dbOf, orderData } from '../../int/helpers/commerce'
import { adminPath, expect, test, testPayload } from '../fixtures'
import { expectAccessible, expectNoHorizontalScroll, removeOrder } from './orderHelpers'

// P6.11 – Reklamationen im Bestell-Detail (KONZEPT §7.8, R-110–R-112): aus „Versendet“ über „Reklamation (Bruch)“ in
// die Akte springen, Reklamation anlegen (Häkchen nicht vorbelegt), Hinweis „bis … bei DHL reklamieren“,
// „Reklamation beantworten“ (M12) und „Streitbeilegungshinweis senden“ (M13) mit Rückfrage – je genau eine Mail.
// Handy 390 px ohne horizontales Scrollen, axe.

const mails = async (orderId: number, template: string) =>
  Number(
    (
      await dbOf(await testPayload()).execute(
        sql`SELECT count(*)::int AS n FROM email_log WHERE order_id = ${orderId} AND template = ${template}`,
      )
    ).rows[0]?.n ?? 0,
  )

test('@a11y Reklamation: aus „Versendet“ anlegen, beantworten (M12) und Streitbeilegungshinweis (M13)', async ({
  adminPage: page,
  fixtureProducts,
}) => {
  const payload = await testPayload()
  const product = await fixtureProducts.create('keramik', {
    status: 'available',
    firstPublishedAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
  })
  const shippedAt = new Date(Date.now() - 2 * 86_400_000).toISOString()
  const created = await createOrder(
    payload,
    orderData(
      90_000 + product.itemNumber * 10 + 8,
      [{ id: product.id, itemNumber: product.itemNumber }],
      {
        seed: true,
        status: 'shipped',
        customer: { name: 'Rita Reklamation', email: 'rita.reklamation@example.com' },
        shipment: {
          carrier: 'dhl',
          trackingNumber: 'JJD000390007999999',
          trackingUrl:
            'https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=JJD000390007999999',
        },
        timestamps: {
          placedAt: new Date(Date.now() - 4 * 86_400_000).toISOString(),
          paidAt: new Date(Date.now() - 4 * 86_400_000).toISOString(),
          shippedAt,
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
    await card.getByTestId('complaint-link').click()
    await expect(page).toHaveURL(new RegExp(`/bestellungen/${order.id}#order-complaints$`))
    const section = page.getByTestId('order-complaints')
    await expect(section.getByTestId('complaints-none')).toBeVisible()

    await section.getByTestId('complaint-new').locator('summary').click()
    const box = section.getByTestId('complaint-item')
    await expect(box).toHaveCount(1)
    await expect(box).not.toBeChecked()
    await box.check()
    await section.getByTestId('complaint-description').fill('Henkel abgebrochen')
    await section.getByTestId('complaint-create').click()
    const c = section.getByTestId('complaint-card')
    await expect(c).toHaveCount(1)
    await expect(c.getByTestId('complaint-carrier-due')).toContainText('bei DHL reklamieren')
    await expect(c.getByTestId('complaint-warranty')).toContainText('Gewährleistung')
    await expect(c.getByTestId('complaint-open')).toHaveAttribute(
      'href',
      /\/collections\/complaints\/\d+$/,
    )
    await expectNoHorizontalScroll(page)
    await expectAccessible(page, '[data-testid="order-complaints"]')

    await c.getByTestId('complaint-reply').click()
    const dialog = page.locator('dialog[open]')
    await expect(dialog).toContainText('Reparatur oder Ersatz anbieten?')
    await dialog.getByTestId('confirm-dialog-ok').dblclick()
    await expect(c.getByTestId('complaint-reply-sent')).toBeVisible()
    await expect(c.getByTestId('complaint-reply')).toHaveCount(0)
    await expect.poll(() => mails(order.id, 'complaint_repair_choice')).toBe(1)

    await c.getByTestId('complaint-dispute').click()
    await page.locator('dialog[open]').getByTestId('confirm-dialog-ok').click()
    await expect(c.getByTestId('complaint-vsbg-sent')).toBeVisible()
    await expect.poll(() => mails(order.id, 'dispute_vsbg')).toBe(1)
  } finally {
    await removeOrder(payload, order.id)
  }
})
