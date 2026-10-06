import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { localizedPath } from '../../../src/lib/routes/paths'
import { adminPath, expect, test, testPayload } from '../fixtures'
import { refreshTattoo, removeMedia, uploadImage } from '../tattoo/tattooFixtures'
import { expectAccessible, expectNoHorizontalScroll } from './orderHelpers'

// P7.6 – Tattoo-Verwaltung `/tattoo`, Reiter „Flash“ (KONZEPT §7.12): Reiter Flash · Galerie · Texte;
// „verfügbar → vergeben“ bei 390×844 in höchstens 2 Taps (Chip antippen, bestätigen), danach Stempel auf der
// öffentlichen Seite; wiederholbares Motiv → Ablehnung mit Hinweis auf „Offline nehmen“; „Neuer Flash“ mit
// Nummernvorschlag (ohne Seed/Fixtures) und Foto-Baustein. Fixtures 986/987 (`seed = true`).

const NUMBERS = [986, 987]
const NEW_TITLE = 'E2E Neuer Flash Hase'
const PHOTO = path.resolve('tests/fixtures/images/landscape-small.jpg')
let image: { id: number; filename: string }

test.describe.configure({ mode: 'serial' })

async function cleanup() {
  const payload = await testPayload()
  await payload.delete({
    collection: 'flash',
    where: { or: [{ number: { in: NUMBERS } }, { title: { equals: NEW_TITLE } }] },
    overrideAccess: true,
    context: { seed: true },
  })
}

test.beforeEach(async () => {
  await cleanup()
  const payload = await testPayload()
  image ??= await uploadImage('Hase mit Tulpe, Tusche')
  const base = { image: image.id, sizeCm: 7, priceCents: 9000, seed: true, sortOrder: 0 }
  await payload.create({
    collection: 'flash',
    data: { ...base, number: 986, title: 'Hase mit Tulpe', status: 'available' } as never,
    overrideAccess: true,
    context: { seed: true },
  })
  await payload.create({
    collection: 'flash',
    data: { ...base, number: 987, title: 'Kleiner Stern', repeatable: true } as never,
    overrideAccess: true,
    context: { seed: true },
  })
})

test.afterAll(async () => {
  await cleanup()
  if (image) await removeMedia([image.id])
})

test('@a11y Flash: verfügbar → vergeben in 2 Taps, Stempel öffentlich; wiederholbar abgelehnt', async ({
  adminPage: page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(adminPath('/tattoo'))
  const tabs = page.getByRole('navigation', { name: 'Bereiche' })
  for (const name of ['Flash', 'Galerie', 'Texte'])
    await expect(tabs.getByRole('link', { name, exact: true })).toBeVisible()
  await expect(tabs.getByRole('link', { name: 'Flash', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
  const card = page.locator('[data-testid="flash-card"][data-number="986"]')
  await expect(card).toHaveAttribute('data-status', 'available')
  await expectNoHorizontalScroll(page)
  await expectAccessible(page, '.pc-admin-view')

  // Tap 1: Chip, Tap 2: Bestätigen
  await card.getByTestId('flash-status-chip').click()
  await page.getByRole('button', { name: 'Ja, vergeben' }).click()
  await expect(card).toHaveAttribute('data-status', 'claimed')
  await expect(card.getByTestId('flash-status-chip')).toContainText('vergeben')

  // öffentliche Seite zeigt den Stempel
  await refreshTattoo(request)
  const pub = await page.context().newPage()
  await pub.goto(localizedPath('R12', 'de'))
  const publicCard = pub.locator('[data-flash-card="F-986"]')
  await expect(publicCard).toHaveAttribute('data-flash-status', 'claimed')
  await expect(publicCard.locator('[data-taken-stamp]')).toContainText('vergeben')
  await pub.close()

  // wiederholbares Motiv: verständliche Ablehnung
  const repeat = page.locator('[data-testid="flash-card"][data-number="987"]')
  await repeat.getByTestId('flash-status-chip').click()
  await page.getByRole('button', { name: 'Ja, vergeben' }).click()
  await expect(page.getByRole('dialog')).toContainText('„Offline nehmen“')
  await page.getByRole('button', { name: 'Abbrechen' }).click()
  await expect(repeat).toHaveAttribute('data-status', 'available')
  // Pausieren = offline nehmen
  await repeat.getByTestId('flash-published').click()
  await expect(repeat).toContainText('offline')
})

test('Neuer Flash: Nummernvorschlag ohne Seed/Fixtures, Foto-Baustein, Speichern', async ({
  adminPage: page,
}) => {
  const payload = await testPayload()
  const real = await payload.find({
    collection: 'flash',
    where: { seed: { not_equals: true } },
    sort: '-number',
    limit: 1,
    overrideAccess: true,
  })
  const expected = ((real.docs[0]?.number as number | undefined) ?? 0) + 1
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(adminPath('/tattoo'))
  await page.getByTestId('flash-new').click()
  const editor = page.getByTestId('flash-editor')
  await expect(editor).toBeVisible()
  await expect(editor.getByTestId('tf-number')).toHaveValue(String(expected))

  await page.getByTestId('photo-gallery').setInputFiles({
    name: 'hase.jpg',
    mimeType: 'image/jpeg',
    buffer: await readFile(PHOTO),
  })
  await expect(page.getByTestId('photo-list').locator('li')).toHaveCount(1)
  await editor.getByTestId('tf-title.de').fill(NEW_TITLE)
  await editor.getByTestId('tf-sizeCm').fill('8,5')
  await editor.getByTestId('tf-priceCents').fill('95')
  await expectNoHorizontalScroll(page)
  await expectAccessible(page, '.pc-admin-view')
  await editor.getByTestId('flash-save').click()
  await expect(editor.getByTestId('flash-saved')).toBeVisible()
  await expect(page).toHaveURL(/bearbeiten=\d+/)
  const saved = await payload.find({
    collection: 'flash',
    where: { title: { equals: NEW_TITLE } },
    overrideAccess: true,
  })
  expect(saved.docs[0]).toMatchObject({ number: expected, priceCents: 9500, sizeCm: 8.5 })
})
