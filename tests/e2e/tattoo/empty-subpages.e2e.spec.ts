import { localizedPath } from '../../../src/lib/routes/paths'
import { LOCALES } from '../../../src/lib/routes/registry'
import { expectNoSeriousViolations } from '../axe'
import { expect, test, testPayload } from '../fixtures'
import { freshPage, NO_CACHE } from '../shop/fresh'
import { refreshTattoo } from './tattooFixtures'

// P20.5 – Beispiele markieren, Flash und Galerie nur mit Inhalt (V-28 a, V-11; U-93):
// 1. Mit dem Beispielbestand (Vorschau-Modus): Flash-Motive und Galerie-Fotos tragen den Stempel „Beispiel“/„Example“
//    (sichtbar, deckt das Motiv nicht zu, Text für Screenreader); Menü und Unter-Navigation führen zu Flash und Galerie.
// 2. Ohne veröffentlichte Motive und Fotos: kein Flash/Galerie in Menü, Unter-Navigation, Übersicht, Preisseite und
//    Sitemap; die Adressen antworten trotzdem mit 200 und einem freundlichen Leerzustand.
// Voraussetzung: `db:reset --test --seed=all`. Der zweite Teil nimmt alle Motive und Fotos kurz offline und stellt den
// vorherigen Stand danach wieder her.

test.describe.configure({ mode: 'serial' })

const subnavIds = (page: import('@playwright/test').Page) =>
  page
    .locator('[data-tattoo-subnav] [data-subnav]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-subnav')))

test.beforeEach(async ({ page }) => {
  await freshPage(page)
})

test('V-28 a Beispiel-Stempel auf Flash und Galerie (DE/EN), Menü mit Flash und Galerie', async ({
  page,
}) => {
  await page.goto(localizedPath('R12', 'de'))
  const f902 = page.locator('#f-902')
  await expect(f902).toHaveAttribute('data-flash-example', '')
  const stamp = f902.locator('[data-example-stamp]')
  await expect(stamp).toBeVisible()
  await expect(stamp).toHaveText('Beispiel')
  await expect(stamp).toHaveAttribute('aria-hidden', 'true')
  await expect(f902.locator('.u-sr-only').first()).toContainText('Preis sind erfunden')
  // deckt das Motiv nicht zu: deutlich kleiner als die Zeichnung
  const [s, d] = await Promise.all([stamp.boundingBox(), f902.locator('img').first().boundingBox()])
  expect(s!.width * s!.height).toBeLessThan(0.25 * d!.width * d!.height)
  await expect(page.locator('#menu a[href="/de/tattoo/flash"]')).toHaveCount(1)
  await expect(page.locator('#menu a[href="/de/tattoo/galerie"]')).toHaveCount(1)
  expect(await subnavIds(page)).toEqual(['R11', 'R12', 'R14', 'R15', 'R16', 'R17', 'R18'])

  await page.goto(localizedPath('R15', 'en'))
  const g3 = page.locator('figure').filter({ hasText: 'Bunny trio, freshly done' })
  await expect(g3.locator('[data-example-stamp]')).toHaveText('Example')
  await expect(g3.locator('a').first()).toHaveAttribute(
    'aria-label',
    /Example photo for the preview only/,
  )
  await expectNoSeriousViolations(page, localizedPath('R15', 'en'))
  // Im Vollbild ist der Stempel nicht zu sehen – „Example“ steht dort in der Bildunterschrift.
  await page.locator('html[data-behaviors-ready]').waitFor({ state: 'attached' })
  await g3.locator('a').first().click()
  const lightbox = page.locator('dialog[data-lightbox]')
  await expect(lightbox).toBeVisible()
  await expect(lightbox.locator('[data-lightbox-caption]')).toHaveText(
    /^Bunny trio, freshly done( · .+)? · Example$/,
  )
  await page.keyboard.press('Escape')
})

test.describe('ohne veröffentlichte Motive und Fotos', () => {
  let flashIds: number[] = []
  let galleryIds: number[] = []

  test.beforeAll(async ({ request }) => {
    const payload = await testPayload()
    const flash = await payload.find({
      collection: 'flash',
      where: { published: { equals: true } },
      limit: 500,
      depth: 0,
      overrideAccess: true,
    })
    const gallery = await payload.find({
      collection: 'tattoo-gallery',
      where: { published: { equals: true } },
      limit: 500,
      depth: 0,
      overrideAccess: true,
    })
    flashIds = flash.docs.map((d) => d.id as number)
    galleryIds = gallery.docs.map((d) => d.id as number)
    for (const id of flashIds)
      await payload.update({
        collection: 'flash',
        id,
        data: { published: false } as never,
        overrideAccess: true,
        context: { seed: true },
      })
    for (const id of galleryIds)
      await payload.update({
        collection: 'tattoo-gallery',
        id,
        data: { published: false } as never,
        overrideAccess: true,
        context: { seed: true },
      })
    await refreshTattoo(request)
  })

  test.afterAll(async ({ request }) => {
    const payload = await testPayload()
    for (const id of flashIds)
      await payload.update({
        collection: 'flash',
        id,
        data: { published: true } as never,
        overrideAccess: true,
        context: { seed: true },
      })
    for (const id of galleryIds)
      await payload.update({
        collection: 'tattoo-gallery',
        id,
        data: { published: true } as never,
        overrideAccess: true,
        context: { seed: true },
      })
    await refreshTattoo(request)
  })

  test('Menü, Unter-Navigation, Übersicht und Preisseite ohne Flash und Galerie (DE/EN)', async ({
    page,
  }) => {
    for (const locale of LOCALES) {
      const flash = localizedPath('R12', locale)
      const gallery = localizedPath('R15', locale)
      await page.goto(localizedPath('R11', locale))
      await expect(page.locator(`#menu a[href="${flash}"]`)).toHaveCount(0)
      await expect(page.locator(`#menu a[href="${gallery}"]`)).toHaveCount(0)
      await expect(page.locator(`#menu a[href="${localizedPath('R14', locale)}"]`)).toHaveCount(1)
      expect(await subnavIds(page), locale).toEqual(['R11', 'R14', 'R16', 'R17', 'R18'])
      await expect(page.locator('[data-tattoo-link="R12"], [data-tattoo-link="R15"]')).toHaveCount(
        0,
      )
      await expect(page.locator('[data-tattoo-link="R14"]')).toHaveCount(1)
      await expect(
        page.locator('[data-tattoo-flash-teaser], [data-tattoo-gallery-teaser]'),
      ).toHaveCount(0)
      await expect(page.locator(`main a[href="${flash}"], main a[href="${gallery}"]`)).toHaveCount(
        0,
      )

      await page.goto(localizedPath('R14', locale))
      await expect(page.locator('[data-price-flash]')).toHaveCount(0)
      await expect(page.locator(`main a[href="${flash}"]`)).toHaveCount(0)
    }
  })

  test('direkte Adressen: 200 mit Leerzustand, keine Flash-Verweise; Sitemap ohne leere Seiten', async ({
    page,
    request,
  }) => {
    for (const locale of LOCALES) {
      const res = await page.goto(localizedPath('R12', locale))
      expect(res?.status()).toBe(200)
      await expect(page.locator('[data-empty-state]')).toBeVisible()
      // die offene Seite bleibt in der Unter-Navigation markiert
      await expect(page.locator('[data-tattoo-subnav] [data-subnav="R12"]')).toHaveAttribute(
        'aria-current',
        'page',
      )
      const res2 = await page.goto(localizedPath('R15', locale))
      expect(res2?.status()).toBe(200)
      const empty = page.locator('[data-empty-state]')
      await expect(empty).toBeVisible()
      await expect(empty.locator('a')).toHaveAttribute('href', localizedPath('R16', locale))
      await expect(empty).not.toContainText(/Flash/i)
    }
    await expectNoSeriousViolations(page, localizedPath('R15', 'en'))

    const sitemap = await (await request.get('/sitemap.xml', { headers: NO_CACHE })).text()
    expect(sitemap).not.toMatch(/\/tattoo\/(flash|galerie|gallery)\b/)
    expect(sitemap).toContain('/de/tattoo/preise</loc>')
  })
})
