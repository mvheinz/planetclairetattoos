import { serverURL } from '../../helpers/adminEnv'
import { expectNoSeriousViolations } from '../axe'
import { expect, test, testPayload } from '../fixtures'
import { refreshTattoo, removeMedia, uploadImage } from './tattooFixtures'

// P7.5 – R15 Galerie (KONZEPT §9.2, §9.7, R-172, R-182): Fixtures analog G1 (Kundenfoto ohne Einwilligung, `seed = true`)
// und G4 (ohne Kund:in, `healed`, echte Datensätze). Der Server läuft mit SEED_PREVIEW_MODE=true und APP_ENV=test:
// G1 erscheint mit Etikett „intern – Einwilligung fehlt“; ein echtes Kundenfoto ohne Einwilligung erscheint nie, seine
// Datei antwortet mit 404 (auch bei erratener URL). Filter `?kind=`, Vollbild mit Bildunterschrift, ohne JavaScript ein
// Link auf die große Datei, R11 zeigt nur sichtbare Bilder.

const CAPTION = {
  g1: 'Fine Line am Unterarm (Test G1)',
  g4: 'Winziger Planet (Test G4)',
  hidden: 'Ohne Einwilligung (Test)',
}
const mediaIds: number[] = []
const entryIds: number[] = []
let hiddenFile = ''
let g1File = ''

test.describe.configure({ mode: 'serial' })

async function removeEntries() {
  const payload = await testPayload()
  await payload.delete({
    collection: 'tattoo-gallery',
    where: { caption: { in: Object.values(CAPTION) } },
    overrideAccess: true,
    context: { seed: true },
  })
}

test.beforeAll(async ({ request }) => {
  await removeEntries()
  const payload = await testPayload()
  const create = async (data: Record<string, unknown>) => {
    const doc = await payload.create({
      collection: 'tattoo-gallery',
      data: { sortOrder: 1, ...data } as never,
      overrideAccess: true,
      context: { seed: true },
    })
    entryIds.push(doc.id as number)
  }
  const g1 = await uploadImage('Fine-Line-Tattoo am Unterarm, verheilt', {
    showsPerson: 'customer',
    seed: true,
  })
  const g4 = await uploadImage('Winziger Planet als Zeichnung')
  const hidden = await uploadImage('Tattoo am Knöchel einer Kundin', { showsPerson: 'customer' })
  mediaIds.push(g1.id, g4.id, hidden.id)
  g1File = g1.filename
  hiddenFile = hidden.filename
  await create({
    image: g1.id,
    kind: 'healed',
    healedDurationMonths: 42,
    caption: CAPTION.g1,
    seed: true,
    published: true,
    featured: true,
  })
  await create({
    image: g4.id,
    kind: 'healed',
    healedDurationMonths: 12,
    caption: CAPTION.g4,
    showsCustomer: false,
    published: true,
  })
  // Echtes Kundenfoto ohne Einwilligung: kann nicht veröffentlicht werden, bleibt offline.
  await create({ image: hidden.id, kind: 'fresh', caption: CAPTION.hidden, published: false })
  await refreshTattoo(request)
})

test.afterAll(async ({ request }) => {
  await removeEntries()
  await removeMedia(mediaIds)
  await refreshTattoo(request)
})

test('R-172 R-182 Galerie: Seed-Ausnahme mit Etikett, Kundenfoto ohne Einwilligung nie, Datei 404', async ({
  page,
  request,
}) => {
  await page.goto('/de/tattoo/galerie')
  const g1 = page.locator('figure').filter({ hasText: CAPTION.g1 })
  await expect(g1).toBeVisible()
  await expect(g1.locator('[data-gallery-internal-label]')).toHaveText(
    'intern – Einwilligung fehlt',
  )
  await expect(g1.locator('[data-gallery-status]')).toHaveText('3,5 Jahre verheilt')
  const g4 = page.locator('figure').filter({ hasText: CAPTION.g4 })
  await expect(g4.locator('[data-gallery-status]')).toHaveText('1 Jahr verheilt')
  await expect(g4.locator('[data-gallery-internal-label]')).toHaveCount(0)
  await expect(page.locator('main')).not.toContainText(CAPTION.hidden)
  await expect(page.locator(`main [href*="${hiddenFile.replace(/\.[a-z]+$/, '')}"]`)).toHaveCount(0)
  await expect(page.locator('main [data-price-tag], main form')).toHaveCount(0)

  // Erratene URL des gesperrten Bildes: 404 (nicht 403); die Seed-Ausnahme im Vorschau-Modus: 200, kurz gecacht.
  const hidden = await request.get(`${serverURL}/api/media/file/${hiddenFile}`)
  expect(hidden.status()).toBe(404)
  const seed = await request.get(`${serverURL}/api/media/file/${g1File}`)
  expect(seed.status()).toBe(200)
  expect(seed.headers()['cache-control']).toBe('public, max-age=300')

  await page.goto('/en/tattoo/gallery')
  await expect(
    page.locator('figure').filter({ hasText: CAPTION.g1 }).locator('[data-gallery-status]'),
  ).toHaveText('3.5 years healed')
})

test('Filter „healed“/„fresh“, Vollbild mit Bildunterschrift, R11 nur sichtbare Bilder', async ({
  page,
}) => {
  await page.goto('/de/tattoo/galerie')
  await page.locator('[data-gallery-filter] [data-chip="fresh"]').click()
  await expect(page).toHaveURL(/\/de\/tattoo\/galerie\?kind=fresh$/)
  await expect(page.locator('figure').filter({ hasText: CAPTION.g4 })).toHaveCount(0)
  await page.locator('[data-gallery-filter] [data-chip="healed"]').click()
  await expect(page).toHaveURL(/\?kind=healed$/)
  await expect(page.locator('[data-gallery-kind="fresh"]')).toHaveCount(0)
  const link = page.locator('figure').filter({ hasText: CAPTION.g4 }).locator('a')
  // Das Modul `lightbox` bindet erst nach `load` (src/behaviors/index.ts); vorher öffnet der Link die Datei (ohne JS).
  await page.locator('html[data-behaviors-ready]').waitFor({ state: 'attached' })
  await link.click()
  const dialog = page.locator('dialog[data-lightbox]')
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('[data-lightbox-caption]')).toContainText(CAPTION.g4)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()

  await page.goto('/de/tattoo')
  const teaser = page.locator('[data-tattoo-gallery-teaser]')
  await expect(teaser.locator('figure').filter({ hasText: CAPTION.g1 })).toBeVisible()
  await expect(teaser).not.toContainText(CAPTION.hidden)
  await expect(teaser.locator('figure')).toHaveCount(
    Math.min(3, await teaser.locator('figure').count()),
  )
})

test('R15 axe ohne serious/critical; ohne JavaScript Link auf die große Datei @a11y', async ({
  page,
  browser,
}) => {
  await page.goto('/de/tattoo/galerie')
  await expectNoSeriousViolations(page, '/de/tattoo/galerie')
  const context = await browser.newContext({ javaScriptEnabled: false })
  try {
    const noJs = await context.newPage()
    await noJs.goto('/de/tattoo/galerie')
    const href = await noJs
      .locator('figure')
      .filter({ hasText: CAPTION.g4 })
      .locator('a')
      .getAttribute('href')
    expect(href).toMatch(/^\/api\/media\/file\//)
    const res = await noJs.request.get(`${serverURL}${href}`)
    expect(res.status()).toBe(200)
  } finally {
    await context.close()
  }
})
