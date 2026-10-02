import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

import { daysUntilCancel } from '../../../src/admin/components/orderActionsModel'
import { createOrder, dbOf, orderData } from '../../int/helpers/commerce'
import { adminPath, expect, test, testPayload } from '../fixtures'
import {
  expectAccessible,
  expectNoHorizontalScroll,
  orderStatus,
  removeOrder,
} from './orderHelpers'

// P5.18 – „Vorkasse offen“ `/vorkasse` (KONZEPT §7.7): Fixture analog O13 (`awaiting_prepayment`, Versand) mit Frist und
// Erinnerung; „Zahlung erhalten“ (Dialog mit erwartetem Betrag und Verwendungszweck, Abweichung → Warnung) → `paid`,
// M05 genau einmal; „Stornieren“ mit Grund; Unterliste „Kürzlich automatisch storniert“: „Nachträglich bezahlt“ (O5)
// bzw. Hinweis „Stück ist schon weg“. Handy 390 px, axe.

const DAY = 86_400_000

const prepayment = (extra: Record<string, unknown>) => ({
  seed: true,
  paymentMethod: 'prepayment',
  paymentProvider: 'bank_transfer',
  ...extra,
})

async function awaiting(payload: Payload, piece: { id: number; itemNumber: number }, k: number) {
  const now = Date.now()
  return createOrder(
    payload,
    orderData(90_000 + piece.itemNumber * 10 + k, [piece], {
      ...prepayment({ status: 'awaiting_prepayment' }),
      prepayment: {
        dueAt: new Date(now + 3 * DAY).toISOString(),
        reminderDueAt: new Date(now + DAY).toISOString(),
      },
      timestamps: { placedAt: new Date(now - 2 * DAY).toISOString() },
    }),
    { system: true, transition: 'O2' },
  )
}

async function timedOut(payload: Payload, piece: { id: number; itemNumber: number }, k: number) {
  const now = Date.now()
  return createOrder(
    payload,
    orderData(90_000 + piece.itemNumber * 10 + k, [piece], {
      ...prepayment({ status: 'cancelled', cancelReason: 'payment_timeout' }),
      prepayment: { dueAt: new Date(now - 2 * DAY).toISOString() },
      timestamps: {
        placedAt: new Date(now - 8 * DAY).toISOString(),
        cancelledAt: new Date(now - 2 * DAY).toISOString(),
      },
    }),
    { seed: true },
  )
}

const mailCount = async (payload: Payload, orderId: number, template: string) =>
  (
    await payload.count({
      collection: 'email-log',
      where: { and: [{ order: { equals: orderId } }, { template: { equals: template } }] },
      overrideAccess: true,
    })
  ).totalDocs

test('@a11y „Vorkasse offen“: Frist, Zahlung erhalten (M05), Stornieren, Nachträglich bezahlt bzw. Stück schon weg', async ({
  adminPage: page,
  fixtureProducts,
}) => {
  const payload = await testPayload()
  const live = { status: 'available', firstPublishedAt: new Date(Date.now() - DAY).toISOString() }
  const [p1, p2, p3, p4] = await Promise.all([
    fixtureProducts.create('keramik', live),
    fixtureProducts.create('keramik', live),
    fixtureProducts.create('keramik', live),
    fixtureProducts.create('keramik', live),
  ])
  const open = await awaiting(payload, p1!, 1)
  const toCancel = await awaiting(payload, p2!, 2)
  const late = await timedOut(payload, p3!, 3)
  const gone = await timedOut(payload, p4!, 4)
  await dbOf(payload).execute(
    sql`UPDATE products SET status = 'sold', sold_channel = 'offline' WHERE id = ${p4!.id}`,
  )
  const ids = [open, toCancel, late, gone].map((o) => o.id as number)
  try {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(adminPath('/vorkasse'))
    const card = page.locator(
      `[data-testid="prepayment-card"][data-order-number="${open.orderNumber}"]`,
    )
    const days = daysUntilCancel((open.prepayment as { dueAt: string }).dueAt, new Date())
    await expect(card.getByTestId('prepayment-deadline')).toContainText(
      `noch ${days} Tage bis Storno`,
    )
    await expect(card.getByTestId('prepayment-reminder')).toContainText('noch nicht verschickt')
    await expect(card).toContainText('53,90')
    await expectNoHorizontalScroll(page)
    await expectAccessible(page, '.pc-admin-view')

    // „Zahlung erhalten“: Dialog mit erwartetem Betrag und Verwendungszweck; Abweichung → Warnung, Bestätigen gesperrt
    await card.getByTestId('prepayment-received').click()
    const dialog = page.locator('dialog[open]')
    await expect(dialog).toContainText('Rechnung')
    await expect(dialog.getByTestId('prepayment-expected')).toContainText('53,90')
    await expect(dialog).toContainText(open.orderNumber as string)
    const amount = dialog.getByTestId('prepayment-amount')
    await expect(amount).toHaveValue('53,90')
    await amount.fill('50,00')
    await expect(dialog.getByTestId('prepayment-mismatch')).toContainText('weicht')
    await expect(dialog.getByTestId('confirm-dialog-ok')).toBeDisabled()
    await expectAccessible(page, 'dialog[open]')
    await amount.fill('53,90')
    await expect(dialog.getByTestId('prepayment-mismatch')).toHaveCount(0)
    await dialog.getByTestId('confirm-dialog-ok').click()
    await expect
      .poll(async () => (await orderStatus(payload, open.id as number)).status)
      .toBe('paid')
    expect(await mailCount(payload, open.id as number, 'prepayment_received')).toBe(1)
    await expect(card).toHaveCount(0)

    // „Stornieren“ mit Grund (Pflicht)
    const other = page.locator(`[data-order-number="${toCancel.orderNumber}"]`)
    await other.getByTestId('prepayment-cancel').click()
    const cancel = page.locator('dialog[open]')
    await expect(cancel.getByTestId('confirm-dialog-ok')).toBeDisabled()
    await cancel.getByTestId('prepayment-cancel-reason').fill('Kundin hat abgesagt')
    await cancel.getByTestId('confirm-dialog-ok').click()
    await expect
      .poll(async () => (await orderStatus(payload, toCancel.id as number)).status)
      .toBe('cancelled')

    // Unterliste: Stück weg → Hinweis; Stück frei → „Nachträglich bezahlt“ (O5)
    const goneCard = page.locator(`[data-order-number="${gone.orderNumber}"]`)
    await expect(goneCard).toHaveAttribute('data-all-available', 'false')
    await expect(goneCard.getByTestId('late-gone')).toContainText('Stück ist schon weg')
    await expect(goneCard.getByTestId('late-paid')).toHaveCount(0)
    const lateCard = page.locator(`[data-order-number="${late.orderNumber}"]`)
    await lateCard.getByTestId('late-paid').click()
    await page.locator('dialog[open]').getByTestId('confirm-dialog-ok').click()
    await expect
      .poll(async () => (await orderStatus(payload, late.id as number)).statusHistory?.at(-1))
      .toMatchObject({ transition: 'O5' })
    expect(await mailCount(payload, late.id as number, 'prepayment_received')).toBe(1)
  } finally {
    for (const id of ids) await removeOrder(payload, id)
  }
})
