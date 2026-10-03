import { sql } from '@payloadcms/db-postgres'
import type { Page } from '@playwright/test'
import type { Payload } from 'payload'

import { getEnv } from '@/lib/env'

import { adminPath, expect, test, testPayload } from '../fixtures'
import { expectAccessible, expectNoHorizontalScroll } from './orderHelpers'

// P6.19 – Mail- und Einwilligungs-Protokolle in der Verwaltung (KONZEPT §6.1, §7.15): Gesamtliste `/export/protokolle`
// mit Filtern (Art, Zeitraum, Status), Empfänger maskiert, keine Freitexte; Mail-Protokoll am Widerruf mit „Kopie an
// mich“ für M08 – die Kopie geht nur an die Verwaltungs-Adresse. Handy 390 px ohne waagerechtes Scrollen, axe.

const CUSTOMER = 'lotte.log@planetclaire.local'
const REASON = 'Freitext im Widerruf – passt farblich nicht'

type Db = { execute: (q: ReturnType<typeof sql>) => Promise<{ rows: Record<string, unknown>[] }> }
const dbOf = (p: Payload) => (p.db as unknown as { drizzle: Db }).drizzle

async function fixture(payload: Payload, tag: string) {
  const w = await payload.create({
    collection: 'withdrawals',
    data: {
      reference: `WR-2026-9${String(Date.now()).slice(-4)}`,
      channel: 'online_form',
      locale: 'de',
      receivedAt: '2026-09-30T10:00:00.000Z',
      name: 'Lotte Log',
      contractIdentification: 'Bestellung vom 20.09.',
      email: CUSTOMER,
      reason: REASON,
      matchStatus: 'needs_manual_match',
      status: 'received',
      refundDueAt: '2026-10-14T10:00:00.000Z',
      submissionSnapshot: { name: 'Lotte Log' },
    } as never,
    overrideAccess: true,
    context: { seed: true },
  })
  await payload.create({
    collection: 'email-log',
    data: {
      template: 'withdrawal_receipt',
      to: CUSTOMER,
      locale: 'de',
      subject: `Eingangsbestätigung ${tag}`,
      idempotencyKey: `e2e-logs:${tag}`,
      status: 'failed',
      attempts: 3,
      withdrawal: w.id,
    } as never,
    overrideAccess: true,
    context: { system: true, skipAudit: true },
  })
  return w.id as number
}

async function cleanup(payload: Payload, id: number) {
  const db = dbOf(payload)
  await db.execute(sql`DELETE FROM email_log WHERE withdrawal_id = ${id}`)
  await db.execute(sql`DELETE FROM withdrawals WHERE id = ${id}`)
}

async function confirm(page: Page) {
  const dialog = page.locator('dialog[open]')
  await expect(dialog).toBeVisible()
  await dialog.getByTestId('confirm-dialog-ok').click()
  await expect(dialog).toBeHidden()
}

test('@a11y Protokolle: Filter, maskierte Empfänger, keine Freitexte, bei 390×844 bedienbar', async ({
  adminPage: page,
}, testInfo) => {
  const payload = await testPayload()
  const tag = `${testInfo.project.name}-${Date.now()}`
  const id = await fixture(payload, tag)
  try {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(adminPath('/export/protokolle?art=mails&status=failed'))
    const table = page.getByTestId('email-log-table')
    await expect(table).toBeVisible()
    const row = table.locator('tr', { hasText: `Eingangsbestätigung ${tag}` })
    await expect(row).toBeVisible()
    await expect(row.getByTestId('email-log-to')).toHaveText('lo***@pl***.local')
    await expect(page.locator('body')).not.toContainText(CUSTOMER)
    await expect(page.locator('body')).not.toContainText(REASON)
    for (const status of await table
      .locator('tbody tr')
      .evaluateAll((rows) => rows.map((r) => r.getAttribute('data-status')))) {
      expect(status).toBe('failed')
    }
    // Filter per Formular: Einwilligungen
    await page.getByLabel('Art').selectOption('einwilligungen')
    await page.getByTestId('protocols-apply').click()
    await expect(page).toHaveURL(/art=einwilligungen/)
    await expect(page.getByTestId('protocols-count')).toBeVisible()
    await expectNoHorizontalScroll(page)
    await expectAccessible(page, '.pc-admin-view')
  } finally {
    await cleanup(payload, id)
  }
})

test('M08 „Kopie an mich“ am Widerruf geht nur an die Verwaltungs-Adresse', async ({
  adminPage: page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop',
    'Serverlogik ist geräteunabhängig; Handy prüft der Test oben',
  )
  const payload = await testPayload()
  const id = await fixture(payload, `copy-${Date.now()}`)
  try {
    await page.goto(adminPath(`/widerrufe/${id}`))
    const mails = page.getByTestId('withdrawal-email-log')
    await expect(mails).toBeVisible()
    await expect(mails).not.toContainText(CUSTOMER)
    await page.getByTestId('withdrawal-receipt-copy').click()
    await confirm(page)
    await expect(page.getByText('Kopie ist unterwegs.')).toBeVisible()
    const copies = await payload.find({
      collection: 'email-log',
      where: { idempotencyKey: { like: `withdrawal_receipt:${id}:copy:` } },
      overrideAccess: true,
    })
    expect(copies.docs).toHaveLength(1)
    expect(copies.docs[0]!.to).not.toBe(CUSTOMER)
    const settings = await payload.findGlobal({ slug: 'settings', overrideAccess: true })
    const admin = settings.adminNotificationEmail || getEnv().ADMIN_NOTIFY_EMAIL
    expect(copies.docs[0]!.to).toBe(admin)
  } finally {
    await cleanup(payload, id)
  }
})
