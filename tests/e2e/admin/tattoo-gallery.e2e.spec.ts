import { randomUUID } from 'node:crypto'

import { request as playwrightRequest } from '@playwright/test'
import { createLocalReq } from 'payload'

import { inTransaction } from '../../../src/lib/payload/transaction'
import { createPrivacyRequest } from '../../../src/lib/privacy/requests'
import { berlinDateKey } from '../../../src/lib/time'
import { adminPath, expect, test, testPayload } from '../fixtures'
import { removeMedia, uploadImage } from '../tattoo/tattooFixtures'
import { expectAccessible, expectNoHorizontalScroll } from './orderHelpers'

// P7.8 – Reiter „Galerie“ (KONZEPT §7.12, E-42, R-172, R-152): Einwilligungs-Häkchen je Foto, „Online“ ohne
// Einwilligung gesperrt mit Hinweis, „Einwilligung widerrufen“ (Dialog mit optionaler Adresse) → offline, Bild-URL 404;
// Link „Galerie-Einwilligung widerrufen“ im DSGVO-Werkzeug führt zur Galerie.

const CAPTION = `E2E-Galerie ${randomUUID().slice(0, 6)}`
let media: { id: number; filename: string } | null = null
let privacyId: number | null = null

test.describe.configure({ mode: 'serial' })

async function cleanup() {
  const payload = await testPayload()
  await payload.delete({
    collection: 'tattoo-gallery',
    where: { caption: { like: 'E2E-Galerie' } },
    overrideAccess: true,
    context: { seed: true },
  })
}

test.beforeEach(async () => {
  await cleanup()
  const payload = await testPayload()
  media = await uploadImage('Fine-Line-Blume am Unterarm', { showsPerson: 'customer' })
  await payload.create({
    collection: 'tattoo-gallery',
    data: {
      image: media.id,
      kind: 'fresh',
      caption: CAPTION,
      showsCustomer: true,
      consentGiven: true,
      consentDate: '2026-09-01T12:00:00.000Z',
      consentNote: 'per Mail am 01.09.2026',
      published: true,
      sortOrder: 0,
    } as never,
    overrideAccess: true,
  })
})

test.afterAll(async () => {
  await cleanup()
  if (media) await removeMedia([media.id])
  if (privacyId) {
    const payload = await testPayload()
    await payload
      .delete({ collection: 'privacy-requests', id: privacyId, overrideAccess: true })
      .catch(() => null)
  }
})

test('@a11y Galerie: Häkchen je Foto, Widerruf nimmt offline (Bild 404), Veröffentlichen ohne Einwilligung gesperrt', async ({
  adminPage: page,
  baseURL,
}) => {
  const payload = await testPayload()
  const doc = await payload.findByID({ collection: 'media', id: media!.id, overrideAccess: true })
  const anon = await playwrightRequest.newContext({ baseURL })
  try {
    expect((await anon.get(doc.url!)).status()).toBe(200)

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(adminPath('/tattoo?reiter=galerie'))
    const card = page.locator('[data-testid="gallery-card"]', { hasText: CAPTION })
    await expect(card.getByTestId('gallery-consent')).toContainText('Einwilligung vom 01.09.2026')
    await expect(card.getByTestId('gallery-consent')).toContainText('online')
    await expectNoHorizontalScroll(page)
    await expectAccessible(page, '.pc-admin-view')

    await card.getByTestId('gallery-withdraw').click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('sofort offline')
    await dialog.getByTestId('gallery-withdraw-email').fill('kundin@example.com')
    await dialog.getByRole('button', { name: 'Widerrufen' }).click()
    await expect(card.getByTestId('gallery-consent')).toContainText('Einwilligung widerrufen am')
    await expect(card.getByTestId('gallery-consent')).toContainText('offline')
    expect((await anon.get(doc.url!)).status()).toBe(404)
    const mails = await payload.find({
      collection: 'email-log',
      where: {
        and: [
          { template: { equals: 'consent_withdrawal_confirmation' } },
          { to: { equals: 'kundin@example.com' } },
        ],
      },
      overrideAccess: true,
    })
    expect(mails.totalDocs).toBeGreaterThanOrEqual(1)
  } finally {
    await anon.dispose()
  }

  // Neues Foto: „Online“ gesperrt, bis die Einwilligung vollständig ist
  await page.getByTestId('gallery-new').click()
  const editor = page.getByTestId('gallery-editor')
  await expect(editor).toContainText(
    'Eine Instagram-Freigabe deckt die Website nicht automatisch ab.',
  )
  await expect(editor.getByTestId('tf-published')).toBeDisabled()
  await expect(editor.getByTestId('gallery-publish-locked')).toHaveText(
    'Ohne Einwilligung der Kundin/des Kunden nicht veröffentlichen.',
  )
  await editor.getByTestId('tf-consentGiven').check()
  await editor.getByTestId('tf-consentDate').fill('2026-09-20')
  await editor.getByTestId('tf-consentNote').fill('per Formular im Studio')
  await expect(editor.getByTestId('tf-published')).toBeEnabled()
  await editor.getByTestId('tf-showsCustomer').uncheck()
  await editor.getByTestId('tf-consentGiven').uncheck()
  await expect(editor.getByTestId('tf-published')).toBeEnabled()
  await expectAccessible(page, '.pc-admin-view')
})

test('DSGVO-Werkzeug: „Galerie-Einwilligung widerrufen“ führt zur Galerie-Aktion', async ({
  adminPage: page,
}) => {
  const payload = await testPayload()
  const now = new Date()
  const req = await createLocalReq({}, payload)
  const r = await inTransaction(req, () =>
    createPrivacyRequest(
      req,
      {
        types: ['consent_withdrawal'],
        receivedAt: berlinDateKey(now),
        channel: 'email',
        contactEmail: 'galerie-widerruf@example.com',
      },
      now,
    ),
  )
  privacyId = r.id as number
  await page.goto(adminPath(`/export/datenschutz/${privacyId}`))
  const link = page.getByTestId('privacy-gallery-consent').getByRole('link', {
    name: 'Galerie-Einwilligung widerrufen',
  })
  await link.click()
  await expect(page).toHaveURL(/\/tattoo\?reiter=galerie$/)
  await expect(page.getByTestId('tattoo-gallery')).toBeVisible()
  await expect(
    page
      .locator('[data-testid="gallery-card"]', { hasText: CAPTION })
      .getByTestId('gallery-withdraw'),
  ).toBeVisible()
})
