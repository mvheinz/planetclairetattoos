import { adminPath, expect, test, testPayload } from '../fixtures'
import { expectAccessible, expectNoHorizontalScroll } from './orderHelpers'

// P5.13 – Einstellungen → „Produktsicherheit“ (R-203): Liste je Kategorie, Vorlage als PDF, Hochladen nur von PDF
// (Magic Bytes) mit Pflicht-Kategorie bei technischen Unterlagen. Qualitäts-Gate der Phasen-Abnahme P5: 390×844 ohne
// horizontales Scrollen, per Tastatur bedienbar, axe ohne serious/critical.

// Kleinste gültige PDF (wie in den Int-Tests): Payload prüft die Datei beim Hochladen.
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\nxref\n0 2\n0000000000 65535 f \n0000000009 00000 n \ntrailer<</Size 2/Root 1 0 R>>\nstartxref\n40\n%%EOF\n',
)

test('@a11y R-203 Produktsicherheit: Kategorien, Vorlage, Hochladen nur PDF mit Kategorie, 390 px, Tastatur', async ({
  adminPage: page,
}, testInfo) => {
  const tag = `E2E-${testInfo.project.name}-${testInfo.repeatEachIndex}-${testInfo.retry}`
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(adminPath('/einstellungen/produktsicherheit'))
  const view = page.getByTestId('product-safety')
  await expect(view).toBeVisible()
  const firstCategory = view.locator('[data-testid^="safety-category-"]').first()
  await expect(firstCategory).toBeVisible()
  await expectNoHorizontalScroll(page)
  await expectAccessible(page, '.pc-admin-view')

  // Vorlage „Technische Unterlagen“ ist ein PDF (nur angemeldet)
  const template = firstCategory.locator('[data-testid^="safety-template-"]')
  const res = await page.request.get((await template.getAttribute('href'))!)
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toContain('application/pdf')

  const upload = page.getByTestId('compliance-upload')
  const submit = page.getByTestId('compliance-upload-submit')
  const fileInput = upload.locator('input[type="file"]')
  const status = upload.getByRole('status').first()

  // Technische Unterlage ohne Kategorie → Hinweis am Formular, nichts hochgeladen
  await fileInput.setInputFiles({ name: 'risiko.pdf', mimeType: 'application/pdf', buffer: PDF })
  await submit.click()
  await expect(status).toContainText('Kategorie')

  // Keine echte PDF (Magic Bytes) → abgelehnt
  const category = upload.getByLabel(/^Kategorie/)
  const value = await category.locator('option').nth(1).getAttribute('value')
  await category.selectOption(value!)
  await fileInput.setInputFiles({
    name: 'falsch.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('kein pdf'),
  })
  await submit.click()
  await expect(status).toContainText('PDF')

  // Tastatur: Notiz eintippen, Knopf fokussieren und mit Enter hochladen
  await fileInput.setInputFiles({ name: 'risiko.pdf', mimeType: 'application/pdf', buffer: PDF })
  const note = upload.getByLabel('Notiz (optional)')
  await note.focus()
  await page.keyboard.type(tag)
  await submit.focus()
  await expect(submit).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(status).toContainText('Gespeichert')
  await expect(
    page
      .getByTestId(`safety-category-${value}`)
      .getByTestId('compliance-doc')
      .filter({ hasText: tag }),
  ).toHaveCount(1)

  // Aufräumen: die hochgeladene Unterlage (über die Local API, als Testdatensatz markiert)
  const payload = await testPayload()
  const docs = await payload.find({
    collection: 'private-uploads',
    where: { note: { equals: tag } },
    overrideAccess: true,
    depth: 0,
  })
  for (const d of docs.docs) {
    await payload.update({
      collection: 'private-uploads',
      id: d.id,
      data: { seed: true } as never,
      overrideAccess: true,
      context: { seed: true, system: true, skipAudit: true },
    })
    await payload.delete({ collection: 'private-uploads', id: d.id, overrideAccess: true })
  }
})
