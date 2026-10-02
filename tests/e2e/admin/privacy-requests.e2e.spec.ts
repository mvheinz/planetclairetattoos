import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

import { adminPath, expect, test, testPayload } from '../fixtures'
import { expectAccessible, expectNoHorizontalScroll } from './orderHelpers'

// P6.16–P6.18 – Ansicht „Datenschutz-Anfragen“ `/export/datenschutz` (KONZEPT §7.15): Anfrage erfassen (Nummer und Frist
// vom Server), Detail mit Frist, Status, Identität, Personensuche und Löschplan; bei 390×844 ohne waagerechtes Scrollen
// und ohne axe-Verstöße.

type Db = { execute: (q: ReturnType<typeof sql>) => Promise<{ rows: Record<string, unknown>[] }> }
const dbOf = (p: Payload) => (p.db as unknown as { drizzle: Db }).drizzle

test('@a11y Datenschutz-Anfrage erfassen, Detail mit Frist, Suche und Löschplan', async ({
  adminPage: page,
}, testInfo) => {
  const payload = await testPayload()
  const email = `ds-${testInfo.project.name}-${Date.now()}@planetclaire.local`
  try {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(adminPath('/export/datenschutz'))
    await expect(page.getByTestId('privacy-requests')).toBeVisible()
    await page.getByTestId('privacy-intake').locator('summary').click()
    await page.getByTestId('privacy-type-access').check()
    await page.getByTestId('privacy-type-erasure').check()
    const field = page.getByTestId('privacy-contactEmail')
    await expect(async () => {
      await field.fill(email)
      await expect(field).toHaveValue(email)
    }).toPass()
    await page.getByTestId('privacy-intake-submit').click()
    await expect(page.getByText(/Anfrage DS-\d{4}-\d{4} angelegt/)).toBeVisible()
    const card = page.getByTestId('privacy-request-card').filter({ hasText: 'Auskunft' }).first()
    await expect(card).toBeVisible()
    await expectNoHorizontalScroll(page)
    await expectAccessible(page, '.pc-admin-view')

    const row = await dbOf(payload).execute(
      sql`SELECT id, reference FROM privacy_requests WHERE contact_email = ${email}`,
    )
    const id = Number(row.rows[0]!.id)
    await page.goto(adminPath(`/export/datenschutz/${id}`))
    await expect(page.getByTestId('privacy-request')).toHaveAttribute('data-status', 'received')
    await expect(page.getByTestId('privacy-detail-due')).toBeVisible()
    await page.getByTestId('privacy-search').click()
    await expect(page.getByTestId('privacy-counts')).toBeVisible()
    await expect(page.getByTestId('privacy-access')).toBeVisible()
    await expectNoHorizontalScroll(page)
    await expectAccessible(page, '.pc-admin-view')
  } finally {
    await dbOf(payload).execute(sql`DELETE FROM privacy_requests WHERE contact_email = ${email}`)
  }
})
