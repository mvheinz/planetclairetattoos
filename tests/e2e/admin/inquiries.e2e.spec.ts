import { request as playwrightRequest } from '@playwright/test'
import type { Payload } from 'payload'
import sharp from 'sharp'

import { adminPath, expect, test, testPayload } from '../fixtures'
import { expectAccessible, expectNoHorizontalScroll } from './orderHelpers'

// P5.20 – „Anfragen“ `/anfragen` und `/anfragen/:id` (KONZEPT §7.11): Liste mit Referenz, Datum, Name, Gegenstand,
// Status und „wird gelöscht am“; Detail mit Angaben, Referenzbild (nur angemeldet abrufbar), Status-Knöpfen, Notiz,
// „Antworten“ (mailto mit Betreff nach Sprache) und „Jetzt löschen“ (Dialog). Handy 390 px, axe.

async function fixtureInquiry(payload: Payload, reference: string) {
  const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#aa3355' } })
    .png()
    .toBuffer()
  const image = await payload.create({
    collection: 'private-uploads',
    data: { purpose: 'commission_reference' } as never,
    file: { data: png, name: 'idee.png', mimetype: 'image/png', size: png.length },
    overrideAccess: true,
    context: { system: true },
  })
  const inquiry = await payload.create({
    collection: 'inquiries',
    data: {
      reference,
      name: 'Erika Beispiel',
      email: 'erika@example.com',
      idea: 'Eine Cap mit einem kleinen Hasen auf der Seite, gern in Grau.',
      objectType: 'cap',
      locale: 'en',
      seed: true,
      referenceImages: [image.id],
    } as never,
    overrideAccess: true,
    context: { seed: true },
  })
  return { inquiry, image }
}

test('@a11y „Anfragen“: Liste, Detail mit Bild, Status, Notiz, Antworten und Jetzt löschen', async ({
  adminPage: page,
  baseURL,
}) => {
  const payload = await testPayload()
  const reference = `AA-2026-${9900 + Math.floor(Math.random() * 99)}`
  const { inquiry, image } = await fixtureInquiry(payload, reference)
  try {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(adminPath('/anfragen'))
    const card = page.locator(`[data-testid="inquiry-card"][data-reference="${reference}"]`)
    await expect(card).toContainText('Erika Beispiel')
    await expect(card).toContainText('Cap')
    await expect(card.getByTestId('inquiry-delete-after')).toContainText('wird gelöscht am')
    await expectNoHorizontalScroll(page)
    await expectAccessible(page, '.pc-admin-view')

    await card.getByRole('link', { name: reference }).click()
    await expect(page.getByTestId('inquiry-detail')).toBeVisible()
    await expect(page.getByTestId('inquiry-data')).toContainText('kleinen Hasen')
    // Bild über die angemeldete Dateiroute geladen …
    const img = page.getByTestId('inquiry-images').locator('img').first()
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth))
      .toBeGreaterThan(0)
    // … ohne Anmeldung nicht abrufbar (AK-10-04, Teil Zugriff)
    const src = await img.getAttribute('src')
    const anon = await playwrightRequest.newContext({ baseURL })
    try {
      expect([401, 403]).toContain((await anon.get(src!)).status())
      expect([401, 403]).toContain(
        (await anon.get(`/api/private-uploads/file/${image.filename}`)).status(),
      )
    } finally {
      await anon.dispose()
    }
    await expect(page.getByTestId('inquiry-reply')).toHaveAttribute(
      'href',
      `mailto:erika@example.com?subject=${encodeURIComponent(`Your request ${reference}`)}`,
    )

    // Status: neu → in Bearbeitung
    await page.getByTestId('inquiry-status-in_progress').click()
    await expect(page.getByTestId('inquiry-status')).toHaveText('in Bearbeitung')
    await expect(page.getByTestId('inquiry-history')).toContainText('in Bearbeitung')
    // Notiz
    await page.getByTestId('notes-text').fill('Größe nachfragen.')
    await page.getByTestId('notes-save').click()
    await expect(page.getByTestId('notes-editor')).toContainText('Notiz gespeichert')
    await expectAccessible(page, '.pc-admin-view')

    // Jetzt löschen (Dialog nennt die Folge)
    await page.getByTestId('inquiry-delete').click()
    const dialog = page.locator('dialog[open]')
    await expect(dialog).toContainText('sofort und endgültig gelöscht')
    await expectAccessible(page, 'dialog[open]')
    await dialog.getByTestId('confirm-dialog-ok').click()
    await expect(page.getByTestId('inquiry-deleted')).toContainText(reference)
    expect(
      await payload.findByID({
        collection: 'inquiries',
        id: inquiry.id,
        overrideAccess: true,
        disableErrors: true,
      }),
    ).toBeNull()
    expect(
      await payload.findByID({
        collection: 'private-uploads',
        id: image.id,
        overrideAccess: true,
        disableErrors: true,
      }),
    ).toBeNull()
  } finally {
    await payload
      .delete({
        collection: 'inquiries',
        id: inquiry.id,
        overrideAccess: true,
        context: { seed: true },
      })
      .catch(() => undefined)
  }
})
