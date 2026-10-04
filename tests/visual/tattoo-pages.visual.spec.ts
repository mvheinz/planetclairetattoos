import { expect, test, type Page } from '@playwright/test'
import type { Payload } from 'payload'

import { localizedPath } from '../../src/lib/routes/paths'
import { testPayload } from '../e2e/fixtures'
import { refreshTattoo, removeMedia, uploadImage } from '../e2e/tattoo/tattooFixtures'
import { dynamicMasks, linuxOnly, loadAllImages, prepare, settle } from './helpers'

// T-12 Seiten der Phase P7 (ARCHITEKTUR §7.6, PLAN P7 Phasen-Abnahme): Tattoo-Bereich R11–R18 und Auftragsarbeiten
// R10 – ganzseitig, DE, je Projekt `desktop` und `mobile`, reduzierte Bewegung. Mini-Bestand als Fixtures (bis P8 gibt
// es keinen Beispielbestand im Tattoo-Bereich): zwei Flash-Motive (frei/vergeben), ein künftiger Flash-Day und zwei
// Galerie-Bilder ohne Kund:in. Der Zustand eines Angebots („in X Tagen“) hängt von der Server-Uhr ab und ist maskiert.
// Fixture-Nummern je Projekt eigene (desktop 991/992, mobile 994/995), danach entfernt.

const NUMBERS: Record<string, [number, number]> = { desktop: [991, 992], mobile: [994, 995] }
const OFFER_TITLE = 'Flash-Day Wintermotive (Visual)'
const CAPTIONS = ['Winziger Planet (Visual)', 'Hasen-Trio frisch gestochen (Visual)']

const PAGES = [
  { name: 'r10-auftragsarbeiten', id: 'R10' },
  { name: 'r11-tattoo', id: 'R11' },
  { name: 'r12-flash', id: 'R12' },
  { name: 'r13-angebote', id: 'R13' },
  { name: 'r14-preise', id: 'R14' },
  { name: 'r15-galerie', id: 'R15' },
  { name: 'r16-ablauf', id: 'R16' },
  { name: 'r17-aftercare', id: 'R17' },
  { name: 'r18-faq', id: 'R18' },
] as const

let payload: Payload
let numbers: [number, number]
const mediaIds: number[] = []

async function removeFixtures() {
  await payload.delete({
    collection: 'flash',
    where: { number: { in: numbers } },
    overrideAccess: true,
    context: { seed: true },
  })
  await payload.delete({
    collection: 'tattoo-offers',
    where: { title: { equals: OFFER_TITLE } },
    overrideAccess: true,
    context: { seed: true },
  })
  await payload.delete({
    collection: 'tattoo-gallery',
    where: { caption: { in: CAPTIONS } },
    overrideAccess: true,
    context: { seed: true },
  })
  await removeMedia(mediaIds.splice(0))
}

test.beforeAll(async ({ request }, testInfo) => {
  linuxOnly()
  payload = await testPayload()
  numbers = NUMBERS[testInfo.project.name] ?? NUMBERS.desktop!
  await removeFixtures()

  const flashImage = await uploadImage('Kelch mit Schlange, Tusche auf Papier')
  mediaIds.push(flashImage.id)
  const flash = [
    { number: numbers[0], title: 'Kelch mit Schlange', status: 'available', priceCents: 12000 },
    { number: numbers[1], title: 'Hasen-Trio', status: 'claimed', priceCents: 9000 },
  ]
  const flashIds: number[] = []
  for (const [i, f] of flash.entries()) {
    const doc = await payload.create({
      collection: 'flash',
      data: {
        ...f,
        image: flashImage.id,
        sizeCm: 9,
        sizeNote: 'Größe anpassbar',
        sortOrder: i,
        seed: true,
      } as never,
      overrideAccess: true,
      context: { seed: true },
    })
    flashIds.push(doc.id as number)
  }

  await payload.create({
    collection: 'tattoo-offers',
    data: {
      type: 'flash_day',
      title: OFFER_TITLE,
      description: 'Kleine Wintermotive zum Sonderpreis – komm vorbei oder schreib mir vorher.',
      startsAt: '2027-12-11T11:00:00.000Z',
      endsAt: '2027-12-11T18:00:00.000Z',
      flashes: flashIds,
      locationNote: 'Berlin-Neukölln',
      published: true,
      seed: true,
    } as never,
    overrideAccess: true,
    context: { seed: true },
  })

  for (const [i, caption] of CAPTIONS.entries()) {
    const image = await uploadImage(i === 0 ? 'Winziger Planet als Zeichnung' : 'Hasen-Trio')
    mediaIds.push(image.id)
    await payload.create({
      collection: 'tattoo-gallery',
      data: {
        image: image.id,
        kind: i === 0 ? 'healed' : 'fresh',
        ...(i === 0 ? { healedDurationMonths: 12 } : {}),
        caption,
        showsCustomer: false,
        published: true,
        sortOrder: i,
        seed: true,
      } as never,
      overrideAccess: true,
      context: { seed: true },
    })
  }
  await refreshTattoo(request)
})

test.afterAll(async ({ request }) => {
  if (!payload) return
  await removeFixtures()
  await refreshTattoo(request)
})

test.beforeEach(async ({ page }) => {
  linuxOnly()
  await prepare(page)
})

/** Server-Uhr (Zustand und Restzeit der Angebote) und Copyright-Jahr. */
const masks = (page: Page) => [...dynamicMasks(page), page.locator('[data-offer-status]')]

for (const p of PAGES) {
  test(`${p.name} (${localizedPath(p.id, 'de')})`, async ({ page }) => {
    const res = await page.goto(localizedPath(p.id, 'de'))
    expect(res?.status()).toBe(200)
    await loadAllImages(page)
    await settle(page)
    await expect(page).toHaveScreenshot(`${p.name}.png`, { fullPage: true, mask: masks(page) })
  })
}
