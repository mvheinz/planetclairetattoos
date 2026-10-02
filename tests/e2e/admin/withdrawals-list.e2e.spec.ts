import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

import { formatBerlin } from '../../../src/lib/time'
import { dbOf } from '../../int/helpers/commerce'
import { adminPath, expect, test, testPayload } from '../fixtures'
import {
  expectAccessible,
  expectNoHorizontalScroll,
  fixtureOrder,
  removeOrder,
} from './orderHelpers'

// P5.19 – „Widerrufe“ `/widerrufe` und `/widerrufe/:id` (KONZEPT §7.10): Fixtures analog W3 (`goods_returned`), W4
// (`received`, `needs_manual_match`) und W5 (`received`, Eingang vor einem Tag) erscheinen als offen, W4 „nicht
// zugeordnet“, W5 „erstatten bis“ Eingang + 14 Tage; Detail mit unveränderlicher Erklärung, Bestellung und Notizen
// (separat speicherbar); Knöpfe seit P6.9 (Ablauf: `withdrawal-inbox.e2e.spec.ts`). Handy 390 px, axe.

const DAY = 86_400_000

async function withdrawal(payload: Payload, data: Record<string, unknown>) {
  return payload.create({
    collection: 'withdrawals',
    data: { channel: 'online_form', locale: 'de', seed: true, ...data } as never,
    overrideAccess: true,
    context: { seed: true },
  })
}

test('@a11y „Widerrufe“: W3, W4, W5 offen, „nicht zugeordnet“, erstatten bis; Detail mit Notiz', async ({
  adminPage: page,
  fixtureProducts,
}) => {
  const payload = await testPayload()
  const live = {
    status: 'available',
    firstPublishedAt: new Date(Date.now() - 20 * DAY).toISOString(),
  }
  const a = await fixtureProducts.create('keramik', live)
  const b = await fixtureProducts.create('keramik', live)
  const o4 = await fixtureOrder(
    payload,
    a,
    90_000 + a.itemNumber * 10 + 5,
    { status: 'delivered' },
    { seed: true },
  )
  const o6 = await fixtureOrder(
    payload,
    b,
    90_000 + b.itemNumber * 10 + 5,
    { status: 'delivered' },
    { seed: true },
  )
  const base = 90_000 + a.itemNumber * 10
  const now = Date.now()
  const w5At = new Date(now - DAY)
  const ws = [
    await withdrawal(payload, {
      reference: `WR-2026-${base + 3}`,
      order: o4.id,
      receivedAt: new Date(now - 9 * DAY).toISOString(),
      name: 'Mia Beispiel',
      email: 'mia@example.com',
      contractIdentification: o4.orderNumber,
      itemsText: 'graue Cap',
      matchStatus: 'auto_matched',
      status: 'goods_returned',
    }),
    await withdrawal(payload, {
      reference: `WR-2026-${base + 4}`,
      receivedAt: new Date(now - 4 * DAY).toISOString(),
      name: 'Rudi Beispiel',
      email: 'rudi@example.com',
      contractIdentification: 'Hab bei dir auf dem Flohmarkt eine Tasse gekauft.',
      itemsText: 'Tasse mit Hund',
      matchStatus: 'needs_manual_match',
      status: 'received',
    }),
    await withdrawal(payload, {
      reference: `WR-2026-${base + 5}`,
      order: o6.id,
      receivedAt: w5At.toISOString(),
      name: 'Erika Beispiel',
      email: 'erika@example.com',
      contractIdentification: `Order ${o6.orderNumber}`,
      itemsText: 'Dress “Bunny Border”',
      reason: 'Lovely dress, but too long for me.',
      locale: 'en',
      matchStatus: 'auto_matched',
      status: 'received',
    }),
  ]
  const [w3, w4, w5] = ws
  try {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(adminPath('/widerrufe'))
    const openList = page.getByTestId('withdrawals-open-list')
    for (const w of ws)
      await expect(openList.locator(`[data-reference="${w.reference}"]`)).toBeVisible()
    await expect(openList.locator(`[data-reference="${w3!.reference}"]`)).toContainText(
      o4.orderNumber,
    )
    await expect(
      openList.locator(`[data-reference="${w4!.reference}"]`).getByTestId('withdrawal-order'),
    ).toHaveText('nicht zugeordnet')
    const due = formatBerlin(new Date(w5At.getTime() + 14 * DAY), 'dd.MM.yyyy')
    await expect(
      openList.locator(`[data-reference="${w5!.reference}"]`).getByTestId('withdrawal-refund-due'),
    ).toHaveText(`erstatten bis ${due}`)
    await expectNoHorizontalScroll(page)
    await expectAccessible(page, '.pc-admin-view')

    // Detail: Erklärung unveränderlich (keine Eingabefelder), Bestellung, Notiz separat speichern
    await openList.locator(`[data-reference="${w4!.reference}"] a`).click()
    await expect(page.getByTestId('withdrawal-detail')).toBeVisible()
    const declaration = page.getByTestId('withdrawal-declaration')
    await expect(declaration).toContainText('Tasse mit Hund')
    await expect(declaration.locator('input, textarea')).toHaveCount(0)
    await expect(page.getByTestId('withdrawal-unmatched')).toBeVisible()
    await expect(page.getByTestId('withdrawal-match')).toBeVisible()
    // Vor dem Hydrieren eingetippter Text ginge verloren – so lange füllen, bis „Notiz speichern“ aktiv ist.
    await expect(async () => {
      await page.getByTestId('notes-text').fill('Rudi per Mail antworten.')
      await expect(page.getByTestId('notes-save')).toBeEnabled({ timeout: 1_000 })
    }).toPass({ timeout: 15_000 })
    await page.getByTestId('notes-save').click()
    await expect(page.getByTestId('notes-editor')).toContainText('Notiz gespeichert')
    const saved = await payload.findByID({
      collection: 'withdrawals',
      id: w4!.id,
      overrideAccess: true,
    })
    expect(saved.adminNotes).toBe('Rudi per Mail antworten.')
    expect(saved.name).toBe('Rudi Beispiel')
    await expectAccessible(page, '.pc-admin-view')

    await page.goto(adminPath(`/widerrufe/${w3!.id}`))
    await expect(page.getByTestId('withdrawal-order-link')).toHaveText(o4.orderNumber)
    await expect(page.getByTestId('withdrawal-payment')).not.toBeEmpty()
  } finally {
    const db = dbOf(payload)
    for (const w of ws) await db.execute(sql`DELETE FROM withdrawals WHERE id = ${w.id}`)
    await removeOrder(payload, o4.id)
    await removeOrder(payload, o6.id)
  }
})
