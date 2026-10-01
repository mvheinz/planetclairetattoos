import { sql } from '@payloadcms/db-postgres'

import { dbOf } from '../../int/helpers/commerce'
import { adminPath, expect, test, testPayload } from '../fixtures'
import {
  expectAccessible,
  expectNoHorizontalScroll,
  fixtureOrder,
  removeOrder,
} from './orderHelpers'

// P5.9 – Bestell-Detail `/bestellungen/:id`: Positionen mit `Nr.`, Titel, Preis; Lieferart, Empfänger:in, Zahlart,
// Beträge, Statusverlauf, Mail-Protokoll mit „erneut senden“ (Bestätigungsdialog nennt die Folge; Doppeltipp im
// Dialog → eine Mail). 390×844 ohne horizontales Scrollen, axe ohne serious/critical.

for (const size of [null, { width: 390, height: 844 }] as const) {
  const label = size ? '390×844' : 'Desktop'
  test(`@a11y Bestell-Detail (${label}): Angaben, Statusverlauf, Mail-Protokoll, „erneut senden“ M01`, async ({
    adminPage: page,
    fixtureProducts,
  }) => {
    if (size) await page.setViewportSize(size)
    const payload = await testPayload()
    const piece = await fixtureProducts.create('keramik', {
      status: 'available',
      firstPublishedAt: new Date(Date.now() - 86_400_000).toISOString(),
    })
    const order = await fixtureOrder(payload, piece, 90_000 + piece.itemNumber * 10 + 1)
    await payload.create({
      collection: 'email-log',
      data: {
        template: 'order_confirmation',
        to: 'erika@example.com',
        locale: 'de',
        subject: `Danke! Deine Bestellung ${order.orderNumber}`,
        idempotencyKey: `order_confirmation:${order.id}:O1`,
        status: 'sent',
        attempts: 1,
        order: order.id,
      } as never,
      overrideAccess: true,
      context: { system: true, skipAudit: true },
    })
    const count = async () =>
      Number(
        (
          await dbOf(payload).execute(
            sql`SELECT count(*)::int AS n FROM email_log WHERE order_id = ${order.id} AND template = 'order_confirmation'`,
          )
        ).rows[0]?.n,
      )
    try {
      await page.goto(adminPath(`/bestellungen/${order.id}`))
      const detail = page.getByTestId('order-detail')
      await expect(detail).toBeVisible()
      await expect(page.getByTestId('order-number')).toHaveText(order.orderNumber)
      await expect(detail).toContainText(`Nr. ${piece.itemNumber}`)
      await expect(detail).toContainText('45,00')
      await expect(detail).toContainText('Versand')
      await expect(detail).toContainText('Musterstraße 1')
      await expect(detail).toContainText('Karte')
      await expect(page.getByTestId('order-history')).toContainText('bezahlt')
      await expect(page.getByTestId('order-emails')).toContainText('M01 Bestellbestätigung')
      await expectNoHorizontalScroll(page)
      await expectAccessible(page, '[data-testid="order-detail"]')

      await page.getByTestId('resend-order_confirmation').click()
      const dialog = page.locator('dialog[open]')
      await expect(dialog).toContainText('Die Kundin bekommt diese Mail noch einmal.')
      await expectAccessible(page, 'dialog[open]')
      await dialog.getByTestId('confirm-dialog-ok').dblclick()
      await expect(page.getByText('Die Mail ist unterwegs.')).toBeVisible()
      expect(await count()).toBe(2)
      await expect(page.getByTestId('order-emails').locator('li')).toHaveCount(2)
    } finally {
      await removeOrder(payload, order.id)
    }
  })
}

test('Bestell-Detail: unbekannte Bestellung zeigt einen Hinweis mit Link in „Alle Daten“', async ({
  adminPage: page,
}) => {
  const res = await page.goto(adminPath('/bestellungen/999999999'))
  expect(res?.status()).toBe(200)
  await expect(page.getByTestId('order-not-found')).toBeVisible()
})
