import { randomBytes } from 'node:crypto'

import type { Page } from '@playwright/test'
import sharp from 'sharp'

import { localizedPath } from '../../../src/lib/routes/paths'
import { expect, testPayload } from '../fixtures'

// Hilfen der Auftragsarbeiten-Tests (P7.13/P7.14): eigene IP je Test (Rate-Limits je IP-Hash, ARCHITEKTUR §8.5), Testbilder
// zur Laufzeit mit sharp, Ausfüllen mit Rücksicht auf die Zeitfalle (≥ 3 s nach dem Laden), Aufräumen per Local API.

export const COMMISSION_DE = localizedPath('R10', 'de')
export const COMMISSION_EN = localizedPath('R10', 'en')
export const TEST_EMAIL_DOMAIN = 'planetclaire.local'

/** Eigene Absender-IP für Rate-Limits (der Server liest den ersten Eintrag von `x-forwarded-for`). */
export async function useFreshIp(page: Page): Promise<string> {
  const ip = `2001:db8:e2e::${randomBytes(3).toString('hex')}`
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': ip })
  return ip
}

/**
 * JPEG mit Rauschen (schlecht komprimierbar), auf genau `bytes` aufgefüllt (Daten nach dem Bildende ignorieren Decoder);
 * so entsteht z. B. eine 3,9-MB-Datei, die der Browser trotzdem schnell verkleinert.
 */
export async function noiseJpeg(bytes: number, width = 1200, height = 1500): Promise<Buffer> {
  const jpeg = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: '#808080',
      noise: { type: 'gaussian', mean: 128, sigma: 40 },
    },
  })
    .jpeg({ quality: 92 })
    .toBuffer()
  if (jpeg.length > bytes) throw new Error(`Testbild zu groß: ${jpeg.length} > ${bytes}`)
  return Buffer.concat([jpeg, Buffer.alloc(bytes - jpeg.length, 0)])
}

/** Seite öffnen und Startzeit merken (Zeitfalle). */
export async function openForm(page: Page, url = COMMISSION_DE): Promise<number> {
  const res = await page.goto(url)
  expect(res?.status()).toBe(200)
  await expect(page.locator('[data-commission-form]')).toBeVisible()
  return Date.now()
}

/** Pflichtfelder ausfüllen. */
export async function fillRequired(
  page: Page,
  values: { name?: string; email: string; objectType?: string; idea?: string },
): Promise<void> {
  await page.locator('#anfrage-name').fill(values.name ?? 'Erika Beispiel')
  await page.locator('#anfrage-email').fill(values.email)
  await page.locator('#anfrage-objectType').selectOption(values.objectType ?? 'cap')
  await page
    .locator('#anfrage-idea')
    .fill(
      values.idea ??
        'Eine Cap mit meinem Dackel Bruno, gern in Grün und mit kleinen Sternen drumherum.',
    )
}

/** Absenden, frühestens 3,2 s nach dem Laden (sonst greift die Zeitfalle). */
export async function submitAfterMinTime(page: Page, loadedAt: number): Promise<void> {
  const wait = 3200 - (Date.now() - loadedAt)
  if (wait > 0) await page.waitForTimeout(wait)
  await page.getByRole('button', { name: /Anfrage senden|Send request/ }).click()
}

export async function inquiryByReference(reference: string) {
  const payload = await testPayload()
  const res = await payload.find({
    collection: 'inquiries',
    where: { reference: { equals: reference } },
    overrideAccess: true,
    depth: 0,
    limit: 1,
  })
  return res.docs[0] ?? null
}

/** Anfragen der Test-Adresse samt Bildern und Mail-Protokoll löschen. */
export async function removeInquiries(email: string): Promise<void> {
  const payload = await testPayload()
  const res = await payload.find({
    collection: 'inquiries',
    where: { email: { equals: email } },
    overrideAccess: true,
    depth: 0,
    limit: 50,
  })
  for (const q of res.docs) {
    const logs = await payload.find({
      collection: 'email-log',
      where: { inquiry: { equals: q.id } },
      overrideAccess: true,
      depth: 0,
      limit: 20,
    })
    for (const l of logs.docs) {
      await payload
        .delete({
          collection: 'email-log',
          id: l.id,
          overrideAccess: true,
          context: { system: true },
        })
        .catch(() => null)
    }
    await payload
      .delete({
        collection: 'inquiries',
        id: q.id,
        overrideAccess: true,
        context: { system: true },
      })
      .catch(() => null)
  }
}

/** Referenzbilder einer Anfrage. */
export async function uploadsOf(ids: (number | { id: number })[] | null | undefined) {
  const payload = await testPayload()
  const out = []
  for (const v of ids ?? []) {
    const id = typeof v === 'number' ? v : v.id
    out.push(
      await payload.findByID({ collection: 'private-uploads', id, overrideAccess: true, depth: 0 }),
    )
  }
  return out
}
