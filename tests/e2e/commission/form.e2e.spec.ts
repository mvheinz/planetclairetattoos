import { readFile } from 'node:fs/promises'
import path from 'node:path'

import exifr from 'exifr'
import sharp from 'sharp'

import { uploadStaticDir } from '../../../src/lib/storage'
import { expectNoSeriousViolations } from '../axe'
import { expect, test } from '../fixtures'
import {
  COMMISSION_DE,
  TEST_EMAIL_DOMAIN,
  fillRequired,
  inquiryByReference,
  noiseJpeg,
  openForm,
  removeInquiries,
  submitAfterMinTime,
  uploadsOf,
  useFreshIp,
} from './commissionHelpers'

// P7.13 – Formular Auftragsarbeiten im Browser (KONZEPT §10, DESIGN KO-12): 5 Bilder à 3,9 MB werden verkleinert,
// einzeln hochgeladen und vollständig gespeichert, ein 6. abgelehnt (AK-10-01); gescheiterter Upload → Hinweis am Bild,
// Absenden ohne das Bild; nach dem Absenden keine Eingaben in der URL (R-137); Datenschutz-Hinweis mit Link am Formular,
// keine Einwilligungs-Checkbox (R-138); GPS-Foto wird ohne EXIF/GPS und gedreht gespeichert (T-05); Tastatur, axe bei
// 390×844, kein Browser-Speicher. Testbilder entstehen zur Laufzeit mit sharp.

const MB = 1024 * 1024
const GPS = path.resolve('tests/fixtures/images/gps-orientation-6.jpg')

test.describe.configure({ mode: 'serial' })

let email = ''
test.beforeEach(async ({}, testInfo) => {
  email = `formular-${testInfo.project.name}-${testInfo.workerIndex}@${TEST_EMAIL_DOMAIN}`
  await removeInquiries(email)
})
test.afterEach(async () => {
  await removeInquiries(email)
})

test('AK-10-01 Formular mit 5 Bildern à 3,9 MB wird vollständig gespeichert; ein 6. Bild wird abgelehnt', async ({
  page,
}) => {
  test.setTimeout(180_000)
  await useFreshIp(page)
  const loadedAt = await openForm(page)
  const files = await Promise.all(
    [0, 1, 2, 3, 4, 5].map(async (i) => ({
      name: `idee-${i + 1}.jpg`,
      mimeType: 'image/jpeg',
      buffer: await noiseJpeg(Math.round(3.9 * MB)),
    })),
  )
  expect(files.every((f) => f.buffer.length > 3.8 * MB)).toBe(true)
  await page.locator('#anfrage-bilder').setInputFiles(files.slice(0, 5))
  await expect(page.locator('[data-commission-image]')).toHaveCount(5)
  await expect(page.locator('[data-commission-image="done"]')).toHaveCount(5, { timeout: 90_000 })
  // ein 6. Bild wird mit Hinweis abgelehnt
  await page.locator('#anfrage-bilder').setInputFiles([files[5]!])
  await expect(page.locator('[data-commission-image-messages]')).toContainText('Höchstens 5 Bilder')
  await expect(page.locator('[data-commission-image]')).toHaveCount(5)
  // Vorschau-Kacheln mit „Entfernen“
  await expect(page.locator('[data-commission-image] img')).toHaveCount(5)
  await expect(page.getByRole('button', { name: 'Bild 1 entfernen' })).toBeVisible()

  await fillRequired(page, { email })
  await submitAfterMinTime(page, loadedAt)
  const success = page.locator('[data-commission-success]')
  await expect(success).toBeVisible({ timeout: 30_000 })
  await expect(success).toBeFocused()
  await expect(success).toContainText(/Danke! Deine Anfrage AA-\d{4}-\d{4} ist angekommen/)
  const reference = (await success.getAttribute('data-reference'))!
  const inquiry = await inquiryByReference(reference)
  expect(inquiry?.referenceImages).toHaveLength(5)
  const uploads = await uploadsOf(inquiry?.referenceImages as number[])
  expect(
    uploads.every((u) => u.status === 'attached' && u.purpose === 'commission_reference'),
  ).toBe(true)
})

test('Fehlerfall: gescheiterter Upload → Hinweis am Bild, Absenden ohne dieses Bild möglich; Fehlerzusammenfassung', async ({
  page,
}) => {
  await useFreshIp(page)
  let calls = 0
  await page.route('**/api/uploads/commission**', async (route) => {
    calls++
    if (calls === 1) await route.fulfill({ status: 500, body: '{"error":"failed"}' })
    else await route.continue()
  })
  const loadedAt = await openForm(page)
  const small = async (n: number) => ({
    name: `skizze-${n}.png`,
    mimeType: 'image/png',
    buffer: await sharp({ create: { width: 40, height: 50, channels: 3, background: '#3a6' } })
      .png()
      .toBuffer(),
  })
  await page.locator('#anfrage-bilder').setInputFiles([await small(1)])
  await expect(page.locator('[data-commission-image="failed"]')).toHaveCount(1)
  await expect(page.locator('[data-commission-image="failed"]')).toContainText(
    'trotzdem ohne dieses Bild absenden',
  )
  await page.locator('#anfrage-bilder').setInputFiles([await small(2)])
  await expect(page.locator('[data-commission-image="done"]')).toHaveCount(1)
  // falscher Typ wird schon im Browser abgelehnt
  await page
    .locator('#anfrage-bilder')
    .setInputFiles([
      { name: 'rechnung.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') },
    ])
  await expect(page.locator('[data-commission-image-messages]')).toContainText('rechnung.pdf')

  // leer absenden → Fehlerzusammenfassung mit Sprunglinks, Eingaben bleiben
  await page.locator('#anfrage-name').fill('Erika Beispiel')
  await submitAfterMinTime(page, loadedAt)
  const summary = page.locator('[data-error-summary]')
  await expect(summary).toBeVisible()
  await expect(summary.locator('a[href="#anfrage-email"]')).toBeVisible()
  await expect(summary.locator('a[href="#anfrage-idea"]')).toBeVisible()
  await expect(page.locator('#anfrage-name')).toHaveValue('Erika Beispiel')
  await expect(page.locator('#anfrage-email')).toHaveAttribute('aria-invalid', 'true')

  await fillRequired(page, { email })
  await page.getByRole('button', { name: 'Anfrage senden' }).click()
  const success = page.locator('[data-commission-success]')
  await expect(success).toBeVisible()
  const inquiry = await inquiryByReference((await success.getAttribute('data-reference'))!)
  expect(inquiry?.referenceImages).toHaveLength(1)
})

test('R-137 Anfrage: nach dem Absenden enthält die URL keine Eingaben; R-138 Anfrage: Datenschutz-Hinweis mit Link, keine Checkbox', async ({
  page,
}) => {
  await useFreshIp(page)
  const loadedAt = await openForm(page)
  const form = page.locator('[data-commission-form]')
  const privacy = page.locator('[data-commission-privacy]')
  await expect(privacy).toContainText('6 Monate nach Eingang automatisch gelöscht')
  await expect(page.locator('[data-commission-privacy-link]')).toHaveAttribute(
    'href',
    '/de/datenschutz#auftragsarbeiten',
  )
  await expect(form.locator('input[type="checkbox"]')).toHaveCount(0)
  await expect(page.locator('[data-commission-images-hint]')).toContainText(
    'Bitte keine Fotos, auf denen Personen erkennbar sind, und keine Gesundheitsangaben.',
  )
  await fillRequired(page, { email, name: 'Rosa Geheim' })
  await submitAfterMinTime(page, loadedAt)
  await expect(page.locator('[data-commission-success]')).toBeVisible()
  const url = new URL(page.url())
  expect(url.pathname).toBe(COMMISSION_DE)
  expect(url.search).toBe('')
  expect(page.url()).not.toContain('Rosa')
  expect(page.url()).not.toContain(encodeURIComponent(email))
})

test('T-05 R-135 GPS-Foto über das Formular: gespeichert ohne EXIF/GPS und richtig gedreht', async ({
  page,
}) => {
  await useFreshIp(page)
  const loadedAt = await openForm(page)
  const gps = await readFile(GPS)
  expect((await exifr.gps(gps))?.latitude).toBeGreaterThan(52)
  await page
    .locator('#anfrage-bilder')
    .setInputFiles([{ name: 'urlaub.jpg', mimeType: 'image/jpeg', buffer: gps }])
  await expect(page.locator('[data-commission-image="done"]')).toHaveCount(1)
  await fillRequired(page, { email })
  await submitAfterMinTime(page, loadedAt)
  const success = page.locator('[data-commission-success]')
  await expect(success).toBeVisible()
  const inquiry = await inquiryByReference((await success.getAttribute('data-reference'))!)
  const [upload] = await uploadsOf(inquiry?.referenceImages as number[])
  const stored = await readFile(path.join(uploadStaticDir('private'), upload!.filename!))
  const meta = await sharp(stored).metadata()
  expect(meta.exif).toBeUndefined()
  expect(meta.orientation ?? 1).toBe(1)
  expect(await exifr.gps(stored).catch(() => undefined)).toBeUndefined()
  // Original 2000×3000 mit Orientation 6 → Querformat
  expect(meta.width!).toBeGreaterThan(meta.height!)
})

test('@a11y Tastatur-Durchlauf, axe bei 390×844, kein Eintrag in localStorage/sessionStorage', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await useFreshIp(page)
  await openForm(page)
  await page.locator('#anfrage-name').focus()
  const order: string[] = []
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press('Tab')
    order.push(
      await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null
        return el?.id || el?.getAttribute('type') || el?.tagName || ''
      }),
    )
  }
  expect(order).toEqual([
    'anfrage-email',
    'anfrage-objectType',
    'anfrage-idea',
    'anfrage-desiredTimeframe',
    'anfrage-budget',
    'anfrage-bilder',
    'submit',
  ])
  // „Etwas anderes“ blendet das Freitextfeld ein
  await page.locator('#anfrage-objectType').selectOption('sonstiges')
  await expect(page.locator('#anfrage-objectTypeOther')).toBeVisible()
  const width = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(width).toBeLessThanOrEqual(390)
  await expectNoSeriousViolations(page, 'R10 Formular 390×844')
  const storage = await page.evaluate(() => [localStorage.length, sessionStorage.length])
  expect(storage).toEqual([0, 0])
})
