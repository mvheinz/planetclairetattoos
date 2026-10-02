import { adminPath, expect, test, testPayload } from '../fixtures'
import { expectAccessible, expectNoHorizontalScroll } from './orderHelpers'

// P6.15 – Löschvorschau (Einstellungen → Datenschutz, LOESCHKONZEPT §4 Regel 5): Trockenlauf aller Löschjobs für die
// nächsten 30 Tage, je Regel die Anzahl; nichts wird gelöscht. Ein Widerruf, dessen Frist in 10 Tagen endet, erscheint
// unter L-08; nach dem Seitenaufruf existiert er noch.

test('@a11y Löschvorschau: fällige Regel mit Anzahl, nichts gelöscht, bei 390×844 bedienbar', async ({
  adminPage: page,
}) => {
  const payload = await testPayload()
  const due = new Date(Date.now() + 10 * 86_400_000).toISOString()
  const w = await payload.create({
    collection: 'withdrawals',
    data: {
      reference: 'WR-2026-99981',
      channel: 'online_form',
      locale: 'de',
      receivedAt: '2026-06-01T10:00:00.000Z',
      name: 'Vorschau Beispiel',
      contractIdentification: 'Test für die Löschvorschau',
      email: 'vorschau@example.com',
      matchStatus: 'needs_manual_match',
      status: 'rejected',
      closeNote: 'Test für die Löschvorschau',
      refundDueAt: '2026-06-15T10:00:00.000Z',
      submissionSnapshot: { name: 'Vorschau Beispiel' },
      spam: {
        markedAt: new Date(Date.parse(due) - 30 * 86_400_000).toISOString(),
        reason: 'Testeintrag Vorschau',
      },
      seed: true,
    } as never,
    overrideAccess: true,
    context: { seed: true },
  })
  try {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(adminPath('/einstellungen#datenschutz'))
    const preview = page.getByTestId('deletion-preview')
    await expect(preview.getByRole('heading', { name: 'Löschvorschau' })).toBeVisible()
    await expect(preview).toContainText('nächsten 30 Tagen')
    const row = preview.locator('tr[data-rule="L-08"]')
    await expect(row).toBeVisible()
    await expect(row).toContainText('Widerrufe')
    await expect(row).toContainText('löschen')
    await expectNoHorizontalScroll(page)
    await expectAccessible(page, '.pc-admin-view')
    // Trockenlauf: der Widerruf existiert noch
    const still = await payload.findByID({
      collection: 'withdrawals',
      id: w.id,
      overrideAccess: true,
      disableErrors: true,
    })
    expect(still?.id).toBe(w.id)
  } finally {
    await payload.delete({
      collection: 'withdrawals',
      id: w.id,
      overrideAccess: true,
      context: { seed: true },
    })
  }
})
