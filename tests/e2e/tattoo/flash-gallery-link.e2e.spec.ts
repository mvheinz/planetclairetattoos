import { expect, test, testPayload } from '../fixtures'
import { refreshTattoo, removeMedia, uploadImage } from './tattooFixtures'

// P14.7 (U-56) – Flash ↔ Galerie: Flash-Karte „Schon gestochen – Foto ansehen“ → Galerie-Eintrag (Anker `g-<id>`), der
// Eintrag „nach Flash F-987“ → Karte (Anker `f-987`). Ein Kundenfoto ohne Einwilligung (echter Datensatz, offline)
// erzeugt keinen Link. Fixture-Motive 986/987 (`seed = true`, Vorschau-Modus des Test-Servers).

const NUMBERS = [986, 987]
const CAPTION = { linked: 'Planet nach Flash (Test U-56)', hidden: 'Ohne Einwilligung (Test U-56)' }
const mediaIds: number[] = []
let linkedId = 0

test.describe.configure({ mode: 'serial' })

async function cleanup() {
  const payload = await testPayload()
  await payload.delete({
    collection: 'tattoo-gallery',
    where: { caption: { in: Object.values(CAPTION) } },
    overrideAccess: true,
    context: { seed: true },
  })
  await payload.delete({
    collection: 'flash',
    where: { number: { in: NUMBERS } },
    overrideAccess: true,
    context: { seed: true },
  })
}

test.beforeAll(async ({ request }) => {
  await cleanup()
  const payload = await testPayload()
  const drawing = await uploadImage('Planet mit Ring, Tusche auf Papier')
  const photo = await uploadImage('Planet mit Ring, frisch gestochen')
  const hidden = await uploadImage('Planet am Knöchel einer Kundin', { showsPerson: 'customer' })
  mediaIds.push(drawing.id, photo.id, hidden.id)
  const make = (number: number, title: string, status: string) =>
    payload.create({
      collection: 'flash',
      data: {
        number,
        title,
        status,
        image: drawing.id,
        sizeCm: 8,
        priceCents: 10000,
        sortOrder: 0,
        seed: true,
      } as never,
      overrideAccess: true,
      context: { seed: true },
    })
  const claimed = await make(987, 'Planet mit Ring', 'claimed')
  const open = await make(986, 'Planet ohne Ring', 'available')
  const linked = await payload.create({
    collection: 'tattoo-gallery',
    data: {
      image: photo.id,
      kind: 'fresh',
      caption: CAPTION.linked,
      showsCustomer: false,
      flash: claimed.id,
      published: true,
      sortOrder: 0,
    } as never,
    overrideAccess: true,
    context: { seed: true },
  })
  linkedId = linked.id as number
  await payload.create({
    collection: 'tattoo-gallery',
    data: {
      image: hidden.id,
      kind: 'fresh',
      caption: CAPTION.hidden,
      flash: open.id,
      published: false,
      sortOrder: 0,
    } as never,
    overrideAccess: true,
    context: { seed: true },
  })
  await refreshTattoo(request)
})

test.afterAll(async ({ request }) => {
  await cleanup()
  await removeMedia(mediaIds)
  await refreshTattoo(request)
})

test('U-56 Flash → Foto und Foto → Flash, nur mit Einwilligung', async ({ page }) => {
  await page.goto('/de/tattoo/flash')
  const claimed = page.locator('#f-987')
  const link = claimed.locator('[data-flash-photo]')
  await expect(link).toHaveText('Schon gestochen – Foto ansehen')
  await expect(link).toHaveAttribute('href', `/de/tattoo/galerie#g-${linkedId}`)
  // Kundenfoto ohne Einwilligung: kein Link.
  await expect(page.locator('#f-986 [data-flash-photo]')).toHaveCount(0)

  await link.click()
  await expect(page).toHaveURL(new RegExp(`/de/tattoo/galerie#g-${linkedId}$`))
  const entry = page.locator(`#g-${linkedId}`)
  await expect(entry).toContainText(CAPTION.linked)
  const back = entry.locator('[data-gallery-flash]')
  await expect(back).toHaveText('nach Flash F-987')
  await expect(back).toHaveAttribute('href', '/de/tattoo/flash#f-987')
  await expect(page.locator('main')).not.toContainText(CAPTION.hidden)

  await back.click()
  await expect(page).toHaveURL(/\/de\/tattoo\/flash#f-987$/)

  await page.goto('/en/tattoo/flash')
  await expect(page.locator('#f-987 [data-flash-photo]')).toHaveText(
    'Already tattooed – see the photo',
  )
  await page.goto('/en/tattoo/gallery')
  await expect(page.locator(`#g-${linkedId} [data-gallery-flash]`)).toHaveText('after flash F-987')
})
