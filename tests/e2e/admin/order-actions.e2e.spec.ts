import AxeBuilder from '@axe-core/playwright'
import { sql } from '@payloadcms/db-postgres'
import type { Page } from '@playwright/test'
import type { Payload } from 'payload'

import { daysUntilCancel } from '../../../src/admin/components/orderActionsModel'
import { createOrder, dbOf, orderData } from '../../int/helpers/commerce'
import { adminPath, expect, test, testPayload } from '../fixtures'

// P4.20 – Admin-Komponente „Aktionen“ an der Bestellung: Knöpfe je Status mit Bestätigungsdialog, der die Folge nennt,
// Betrag, Verwendungszweck und „noch X Tage bis Storno“; „Zahlung erhalten“ führt zu O3. Desktop und 390×844, axe
// (`@a11y`) auf Komponente und Dialog. Die Beispiel-Bestellung (`seed = true`) wird danach entfernt.

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function awaitingOrder(payload: Payload, productId: number, itemNumber: number) {
  const dueAt = new Date(Date.now() + 3 * 86_400_000)
  const order = await createOrder(
    payload,
    orderData(90_000 + itemNumber, [{ id: productId, itemNumber }], {
      status: 'awaiting_prepayment',
      paymentMethod: 'prepayment',
      paymentProvider: 'bank_transfer',
      prepayment: {
        dueAt: dueAt.toISOString(),
        reminderDueAt: new Date(Date.now() + 86_400_000).toISOString(),
      },
      timestamps: { placedAt: new Date().toISOString() },
      seed: true,
    }),
    { system: true, transition: 'O2' },
  )
  return { id: order.id as number, orderNumber: order.orderNumber as string, dueAt }
}

async function removeOrder(payload: Payload, id: number) {
  const db = dbOf(payload)
  await db.execute(sql`UPDATE products SET current_order_id = NULL WHERE current_order_id = ${id}`)
  await db.execute(sql`UPDATE orders SET invoice_id = NULL WHERE id = ${id}`)
  await db.execute(
    sql.raw(`DO $$ BEGIN
      ALTER TABLE invoices DISABLE TRIGGER USER;
      DELETE FROM invoices WHERE order_id = ${Number(id)};
      ALTER TABLE invoices ENABLE TRIGGER USER;
    END $$`),
  )
  await db.execute(sql`DELETE FROM email_log WHERE order_id = ${id}`)
  await payload.delete({ collection: 'orders', id, overrideAccess: true, context: { seed: true } })
}

async function expectAccessible(page: Page, selector: string) {
  const result = await new AxeBuilder({ page }).include(selector).withTags(TAGS).analyze()
  const blocking = result.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.help}`)
  expect(blocking).toEqual([])
}

for (const size of [null, { width: 390, height: 844 }] as const) {
  const label = size ? '390×844' : 'Desktop'
  test(`@a11y Vorkasse offen (${label}): Betrag, Verwendungszweck, Resttage; Dialoge nennen die Folge; „Zahlung erhalten“ → bezahlt`, async ({
    adminPage: page,
    fixtureProducts,
  }) => {
    if (size) await page.setViewportSize(size)
    const payload = await testPayload()
    const piece = await fixtureProducts.create('keramik', {
      status: 'available',
      firstPublishedAt: new Date(Date.now() - 86_400_000).toISOString(),
    })
    const order = await awaitingOrder(payload, piece.id, piece.itemNumber)
    try {
      await page.goto(adminPath(`/collections/orders/${order.id}`))
      const box = page.getByTestId('order-actions')
      await expect(box).toBeVisible()
      await expect(box).toContainText('Betrag')
      await expect(box).toContainText('53,90')
      await expect(box).toContainText(`Verwendungszweck: ${order.orderNumber}`)
      await expect(box).toContainText(
        `noch ${daysUntilCancel(order.dueAt, new Date())} Tage bis Storno`,
      )
      await expectAccessible(page, '[data-testid="order-actions"]')

      // „Stornieren“: Dialog nennt die Folge, Abbrechen ändert nichts
      await box.getByRole('button', { name: 'Stornieren' }).click()
      const cancelDialog = page.getByRole('dialog', { name: 'Stornieren' })
      await expect(cancelDialog).toBeVisible()
      await expect(cancelDialog).toContainText(
        'Die Kundin bekommt eine Mail mit deinem Text, dass die Bestellung storniert ist.',
      )
      await expectAccessible(page, 'dialog[open]')
      await cancelDialog.getByRole('button', { name: 'Abbrechen' }).click()
      await expect(cancelDialog).toBeHidden()

      // „Zahlung erhalten“ → O3
      await box.getByRole('button', { name: 'Zahlung erhalten' }).click()
      const paidDialog = page.getByRole('dialog', { name: 'Zahlung erhalten' })
      await expect(paidDialog).toContainText('Die Kundin bekommt eine Mail mit der Rechnung.')
      await expect(paidDialog.getByLabel('Eingegangener Betrag (Euro)')).toHaveValue('53,90')
      const confirm = paidDialog.getByRole('button', { name: 'Bestätigen' })
      // Komponente und Dialog passen in die Breite (der Kopf der Payload-Ansicht selbst ist nicht Teil dieser Aufgabe)
      const width = page.viewportSize()!.width
      for (const el of [box, paidDialog]) {
        const b = (await el.boundingBox())!
        expect(b.x).toBeGreaterThanOrEqual(0)
        expect(b.x + b.width).toBeLessThanOrEqual(width)
      }
      const [response] = await Promise.all([
        page.waitForResponse((r) => r.url().includes(`/orders/${order.id}/prepayment-received`)),
        confirm.click(),
      ])
      expect(response.status()).toBe(200)
      await expect
        .poll(
          async () =>
            (await payload.findByID({ collection: 'orders', id: order.id, overrideAccess: true }))
              .status,
        )
        .toBe('paid')
      await page.waitForLoadState('load')
      await expect(page.getByTestId('order-actions')).toHaveCount(0)
    } finally {
      await removeOrder(payload, order.id)
    }
  })
}
