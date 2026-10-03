import path from 'node:path'
import { existsSync } from 'node:fs'

import sharp from 'sharp'

import { uploadStaticDir } from '../../../src/lib/storage'
import { serverURL } from '../../helpers/adminEnv'
import { adminPath, expect, test, testPayload } from '../fixtures'
import {
  fillRequired,
  inquiryByReference,
  openForm,
  removeInquiries,
  SUBMIT_TIMEOUT,
  submitAfterMinTime,
  TEST_EMAIL_DOMAIN,
  uploadsOf,
  useFreshIp,
} from './commissionHelpers'

// P7.14 – Durchstich Auftragsarbeiten (KONZEPT §10.4, §7.11, R-160, R-136, L-10): Formular mit 2 Bildern → M11 und A05
// im Mail-Protokoll → Anfrage in der Verwaltung („Anfragen“, P5.20) mit Bildern nur nach Anmeldung, Angebots-Vorlage
// `commission.offer` (R-161) und Hinweis auf den Umsatz-Wächter → „Jetzt löschen“ entfernt Anfrage, Bilder und Dateien.

test.describe.configure({ mode: 'serial' })

let email = ''
test.beforeEach(async ({}, testInfo) => {
  email = `ablauf-${testInfo.project.name}-${testInfo.workerIndex}@${TEST_EMAIL_DOMAIN}`
  await removeInquiries(email)
})
test.afterEach(async () => {
  await removeInquiries(email)
})

test('R-160 Formular mit 2 Bildern → M11 und A05 im Mail-Log → Verwaltung mit Bildern nur angemeldet → „Jetzt löschen“ entfernt alles', async ({
  browser,
  adminPage,
  request,
}) => {
  test.setTimeout(120_000)
  // Formular in einem eigenen, nicht angemeldeten Kontext
  const visitor = await browser.newContext()
  const page = await visitor.newPage()
  await useFreshIp(page)
  const loadedAt = await openForm(page)
  const image = async (n: number, color: string) => ({
    name: `motiv-${n}.jpg`,
    mimeType: 'image/jpeg',
    buffer: await sharp({ create: { width: 300, height: 400, channels: 3, background: color } })
      .jpeg()
      .toBuffer(),
  })
  await page
    .locator('#anfrage-bilder')
    .setInputFiles([await image(1, '#c63'), await image(2, '#36c')])
  await expect(page.locator('[data-commission-image="done"]')).toHaveCount(2)
  await fillRequired(page, { email, objectType: 'teller' })
  await page.locator('#anfrage-desiredTimeframe').fill('bis Weihnachten')
  await submitAfterMinTime(page, loadedAt)
  const success = page.locator('[data-commission-success]')
  await expect(success).toBeVisible({ timeout: SUBMIT_TIMEOUT })
  const reference = (await success.getAttribute('data-reference'))!
  const inquiry = (await inquiryByReference(reference))!
  expect(inquiry).toBeTruthy()
  const uploads = await uploadsOf(inquiry.referenceImages as number[])
  expect(uploads).toHaveLength(2)
  await visitor.close()

  // Mail-Protokoll: M11 an die Anfragende, A05 an Jutta
  const payload = await testPayload()
  await expect
    .poll(async () => {
      const logs = await payload.find({
        collection: 'email-log',
        where: { inquiry: { equals: inquiry.id } },
        overrideAccess: true,
        depth: 0,
      })
      return logs.docs
        .map((l) => `${l.template}:${l.status}`)
        .sort()
        .join(',')
    })
    .toBe('admin_inquiry_received:sent,inquiry_receipt:sent')

  // Bilder ohne Anmeldung nicht abrufbar (R-136, AK-10-04)
  for (const u of uploads) {
    const res = await request.get(`${serverURL}/api/private-uploads/file/${u.filename}`, {
      failOnStatusCode: false,
    })
    expect([401, 403], u.filename!).toContain(res.status())
  }

  // Verwaltung: Detail mit Bildern, Frist, Angebots-Vorlage und Umsatz-Hinweis
  await adminPage.goto(adminPath(`/anfragen/${inquiry.id}`))
  await expect(adminPage.getByTestId('inquiry-reference')).toHaveText(reference)
  await expect(adminPage.getByTestId('inquiry-delete-after')).toContainText('wird gelöscht am')
  await expect(adminPage.getByTestId('inquiry-images').locator('img')).toHaveCount(2)
  const thumb = adminPage.getByTestId('inquiry-images').locator('img').first()
  await expect
    .poll(() => thumb.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0)
  await expect(adminPage.getByTestId('inquiry-offer')).toBeVisible()
  await expect(adminPage.getByTestId('inquiry-offer-copy')).toBeVisible()
  await expect(adminPage.getByTestId('inquiry-offer-mail')).toHaveAttribute(
    'href',
    new RegExp(`^mailto:.*subject=${encodeURIComponent(`Angebot zu deiner Anfrage ${reference}`)}`),
  )
  await expect(adminPage.getByTestId('inquiry-revenue-hint')).toContainText('Auftragsarbeiten')
  await expect(adminPage.getByTestId('inquiry-email-log')).toContainText(reference)

  // „Jetzt löschen“
  await adminPage.getByTestId('inquiry-delete').click()
  await adminPage.getByRole('dialog').getByRole('button', { name: 'Jetzt löschen' }).click()
  await expect(adminPage).toHaveURL(/\/anfragen\?geloescht=/)
  expect(await inquiryByReference(reference)).toBeNull()
  for (const u of uploads) {
    const gone = await payload.find({
      collection: 'private-uploads',
      where: { id: { equals: u.id } },
      overrideAccess: true,
      depth: 0,
    })
    expect(gone.docs).toHaveLength(0)
    expect(existsSync(path.join(uploadStaticDir('private'), u.filename!))).toBe(false)
  }
})
