import { sql } from '@payloadcms/db-postgres'
import type { Page } from '@playwright/test'
import type { Payload } from 'payload'

import { dbOf } from '../../int/helpers/commerce'
import { adminPath, expect, test, testPayload } from '../fixtures'
import {
  expectAccessible,
  expectNoHorizontalScroll,
  fixtureOrder,
  removeOrder,
} from './orderHelpers'

// P6.9 – Widerrufs-Posteingang (KONZEPT §7.10, R-094): „Bestellung zuordnen“ (Suche) → O11, „Ohne Erstattung
// abschließen“ → O20; „Ware ist zurück“ mit Zustandsnotiz und „Rücksendenachweis liegt vor“; „Widerruf manuell
// erfassen“ (Brief, ohne E-Mail, keine Kund:innen-Mail). Handy 390 px, axe.

const DAY = 86_400_000

async function withdrawal(payload: Payload, data: Record<string, unknown>) {
  return payload.create({
    collection: 'withdrawals',
    data: {
      channel: 'online_form',
      locale: 'de',
      seed: true,
      status: 'received',
      ...data,
    } as never,
    overrideAccess: true,
    context: { seed: true },
  })
}

async function removeWithdrawals(payload: Payload, where: ReturnType<typeof sql>) {
  const db = dbOf(payload)
  await db.execute(
    sql`DELETE FROM email_log WHERE withdrawal_id IN (SELECT id FROM withdrawals WHERE ${where})`,
  )
  await db.execute(sql`DELETE FROM withdrawals WHERE ${where}`)
}

async function confirm(page: Page) {
  const dialog = page.locator('dialog[open]')
  await expect(dialog).toBeVisible()
  await dialog.getByTestId('confirm-dialog-ok').click()
  await expect(dialog).toBeHidden()
}

/** Vor dem Hydrieren Getipptes ginge verloren – so lange füllen, bis der Wert steht. */
async function fillHydrated(page: Page, testId: string, value: string) {
  await expect(async () => {
    await page.getByTestId(testId).fill(value)
    await expect(page.getByTestId(testId)).toHaveValue(value, { timeout: 1_000 })
  }).toPass({ timeout: 15_000 })
}

test('@a11y R-094 zuordnen (Suche) → O11, ohne Erstattung abschließen → O20', async ({
  adminPage: page,
  fixtureProducts,
}) => {
  const payload = await testPayload()
  const piece = await fixtureProducts.create('keramik', {
    status: 'available',
    firstPublishedAt: new Date(Date.now() - 20 * DAY).toISOString(),
  })
  const order = await fixtureOrder(
    payload,
    piece,
    90_000 + piece.itemNumber * 10 + 7,
    { status: 'delivered', customer: { name: 'Lotte Zuordnung', email: 'lotte@example.com' } },
    { seed: true },
  )
  const ref = `WR-2026-${90_000 + piece.itemNumber * 10 + 7}`
  const w = await withdrawal(payload, {
    reference: ref,
    receivedAt: new Date(Date.now() - 2 * DAY).toISOString(),
    name: 'Lotte Zuordnung',
    email: 'lotte@example.com',
    contractIdentification: 'Bestellung vom letzten Monat, Becher',
    matchStatus: 'needs_manual_match',
  })
  try {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(adminPath(`/widerrufe/${w.id}`))
    await expect(page.getByTestId('withdrawal-match')).toBeVisible()
    await fillHydrated(page, 'withdrawal-match-query', 'lotte@example')
    await page.getByTestId('withdrawal-match').getByRole('button', { name: 'Suchen' }).click()
    await page.getByTestId(`withdrawal-match-${order.id}`).click()
    await confirm(page)
    await expect(page.getByTestId('withdrawal-order-link')).toHaveText(order.orderNumber)
    const matched = await payload.findByID({
      collection: 'orders',
      id: order.id,
      overrideAccess: true,
    })
    expect(matched.status).toBe('withdrawal_received')
    await expectNoHorizontalScroll(page)
    await expectAccessible(page, '.pc-admin-view')

    await page.getByTestId('withdrawal-close-reason').selectOption('retracted')
    await page.getByTestId('withdrawal-close-button').click()
    await confirm(page)
    await expect(page.getByTestId('withdrawal-detail')).toContainText(
      'Dieser Widerruf ist abgeschlossen',
    )
    const after = await payload.findByID({
      collection: 'orders',
      id: order.id,
      overrideAccess: true,
    })
    expect(after.status).toBe('delivered')
    const doc = await payload.findByID({
      collection: 'withdrawals',
      id: w.id,
      overrideAccess: true,
    })
    expect(doc).toMatchObject({
      status: 'closed',
      closeReason: 'retracted',
      matchStatus: 'manually_matched',
    })
  } finally {
    await removeWithdrawals(payload, sql`reference = ${ref}`)
    await removeOrder(payload, order.id)
  }
})

test('R-094 „Ware ist zurück“ mit Zustandsnotiz und Rücksendenachweis', async ({
  adminPage: page,
  fixtureProducts,
}) => {
  const payload = await testPayload()
  const piece = await fixtureProducts.create('keramik', {
    status: 'available',
    firstPublishedAt: new Date(Date.now() - 20 * DAY).toISOString(),
  })
  const ref = `WR-2026-${90_000 + piece.itemNumber * 10 + 8}`
  const w = await withdrawal(payload, {
    reference: ref,
    receivedAt: new Date(Date.now() - 3 * DAY).toISOString(),
    name: 'Paul Rücksendung',
    email: 'paul@example.com',
    contractIdentification: 'Teller, Flohmarkt',
    matchStatus: 'needs_manual_match',
  })
  try {
    await page.goto(adminPath(`/widerrufe/${w.id}`))
    await page.getByTestId('withdrawal-return-proof').click()
    await confirm(page)
    await expect(page.getByTestId('withdrawal-proof-done')).toBeVisible()
    await fillHydrated(page, 'withdrawal-goods-note', 'Gut verpackt, unbeschädigt.')
    await page.getByTestId('withdrawal-goods-returned').click()
    await confirm(page)
    await expect(page.getByTestId('withdrawal-return-note')).toContainText('Gut verpackt')
    const doc = await payload.findByID({
      collection: 'withdrawals',
      id: w.id,
      overrideAccess: true,
    })
    expect(doc.status).toBe('goods_returned')
    expect(doc.goodsReturnedAt).toBeTruthy()
    expect(doc.returnProofReceivedAt).toBeTruthy()
  } finally {
    await removeWithdrawals(payload, sql`reference = ${ref}`)
  }
})

test('R-094 DM-WDR-04 Widerruf manuell erfassen: Brief ohne E-Mail, „Eingangsbestätigung“ nicht vorausgewählt', async ({
  adminPage: page,
}, testInfo) => {
  const payload = await testPayload()
  const name = `Brief ${testInfo.project.name} ${Date.now()}`
  try {
    await page.goto(adminPath('/widerrufe'))
    await page.getByTestId('withdrawal-manual').locator('summary').click()
    await expect(page.getByTestId('manual-send')).not.toBeChecked()
    await expect(page.getByTestId('manual-send')).toBeDisabled()
    await page.getByTestId('manual-channel').selectOption('letter')
    await page.getByTestId('manual-receivedAt').fill('2026-09-28T10:15')
    await fillHydrated(page, 'manual-name', name)
    await page
      .getByTestId('manual-contractIdentification')
      .fill('Brief: Bestellung vom 20.09., Vase')
    await page.getByTestId('manual-submit').click()
    await confirm(page)
    await expect(page.getByText(/Erfasst als WR-\d{4}-\d{5}/)).toBeVisible()
    const res = await payload.find({
      collection: 'withdrawals',
      where: { name: { equals: name } },
      overrideAccess: true,
    })
    expect(res.docs).toHaveLength(1)
    expect(res.docs[0]).toMatchObject({
      channel: 'letter',
      receivedAt: '2026-09-28T08:15:00.000Z',
      email: null,
      status: 'received',
    })
    const mails = await payload.count({
      collection: 'email-log',
      where: { withdrawal: { equals: res.docs[0]!.id } },
      overrideAccess: true,
    })
    expect(mails.totalDocs).toBe(0)
  } finally {
    await removeWithdrawals(payload, sql`name = ${name}`)
  }
})
