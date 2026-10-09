import { localizedPath } from '../../../src/lib/routes/paths'
import { expect, test, testPayload } from '../fixtures'
import { removeMedia, uploadImage } from '../tattoo/tattooFixtures'
import { freshPage, holdListData } from './fresh'
import { ANCHORS, openProduct } from './productPage'

// P14.8 (U-57) – Shop: „Frag nach diesem Stück“ (Mail mit Nummer im Betreff), verkauft → „Etwas Ähnliches anfragen“
// (Auftragsarbeiten), verkaufte Stücke nur als kurze Reihe (≤ 4) unter den verfügbaren mit „Archiv ansehen“ und das
// optionale Foto zum Größenvergleich als letztes Galeriebild. Grundlage: Mini-Beispielbestand (S01, S06 sold, S11).

const shop = localizedPath('R02', 'de')

test.describe('Shop-Liste: verkaufte nur als kurze Reihe (U-57 c)', () => {
  holdListData(test, 'shared')
  test.beforeEach(async ({ page }) => freshPage(page))

  test('Raster ohne verkaufte, darunter höchstens 4 verkaufte und „Archiv ansehen“; R03 mit Kategorie-Filter', async ({
    page,
  }) => {
    await page.goto(shop)
    const main = page.locator('section[aria-labelledby="list-heading"] [data-product-card]')
    expect(await main.count()).toBeGreaterThan(0)
    await expect(
      page.locator(
        'section[aria-labelledby="list-heading"] [data-product-card][data-status="sold"]',
      ),
    ).toHaveCount(0)
    const row = page.locator('[data-sold-row]')
    await expect(row.locator('h2')).toHaveText('Schon weitergezogen')
    const sold = row.locator('[data-product-card]')
    const n = await sold.count()
    expect(n).toBeGreaterThan(0)
    expect(n).toBeLessThanOrEqual(4)
    expect(await row.locator('[data-product-card][data-status="sold"]').count()).toBe(n)
    const archive = row.locator('[data-archive-link]')
    await expect(archive).toHaveText('Archiv ansehen')
    await expect(archive).toHaveAttribute('href', localizedPath('R05', 'de'))

    await page.goto(localizedPath('R03', 'de', { slug: 'keramik' }))
    await expect(page.locator('[data-sold-row] [data-archive-link]')).toHaveAttribute(
      'href',
      `${localizedPath('R05', 'de')}?category=keramik`,
    )
    // „nur verfügbare“: keine Reihe
    await page.goto(`${shop}?available=1`)
    await expect(page.locator('[data-sold-row]')).toHaveCount(0)

    await page.goto(localizedPath('R02', 'en'))
    await expect(page.locator('[data-sold-row] [data-archive-link]')).toHaveText('View the archive')
  })
})

test.describe('Produktseite: Frage-Link, „Ähnliches anfragen“, Größenvergleich (U-57 a, b, d)', () => {
  test('verfügbar: Mail-Link mit „Frage zu Nr. 911 – …“; verkauft: Link auf Auftragsarbeiten', async ({
    page,
    request,
  }) => {
    await openProduct(page, request, ANCHORS.S11.de)
    const ask = page.locator('[data-product-ask]')
    await expect(ask).toHaveText('Frag nach diesem Stück')
    const href = (await ask.getAttribute('href')) ?? ''
    expect(href).toMatch(/^mailto:[^?]+@[^?]+\?subject=/)
    const subject = decodeURIComponent(/subject=([^&]+)/.exec(href)![1]!)
    expect(subject).toBe('Frage zu Nr. 911 – T-Shirt „Coco fliegt zum Mond“')
    expect(decodeURIComponent(href)).toContain(ANCHORS.S11.de)

    await openProduct(page, request, ANCHORS.S11.en)
    const en = (await page.locator('[data-product-ask]').getAttribute('href')) ?? ''
    expect(decodeURIComponent(/subject=([^&]+)/.exec(en)![1]!)).toMatch(
      /^Question about No\. 911 – /,
    )

    await openProduct(page, request, ANCHORS.S06.de)
    await expect(page.locator('[data-product-ask]')).toHaveCount(0)
    const similar = page.locator('[data-buy-area] [data-ask-similar]')
    await expect(similar).toHaveText('Etwas Ähnliches anfragen')
    await expect(similar).toHaveAttribute('href', localizedPath('R10', 'de'))
  })

  test('Foto zum Größenvergleich steht als letztes Bild mit Beschriftung (DE/EN)', async ({
    page,
    request,
  }) => {
    const payload = await testPayload()
    const image = await uploadImage('T-Shirt neben einem Lineal')
    const set = (scalePhoto: number | null) =>
      payload.update({
        collection: 'products',
        where: { itemNumber: { equals: 911 } },
        data: { scalePhoto } as never,
        overrideAccess: true,
        context: { seed: true },
      })
    try {
      await set(image.id)
      await openProduct(page, request, ANCHORS.S11.de)
      const slides = page.locator('[data-gallery-slide]')
      const last = slides.last()
      await expect(last).toHaveAttribute('data-gallery-scale', '')
      await expect(last.locator('[data-scale-caption]')).toHaveText('Zum Größenvergleich')
      await expect(page.locator('[data-gallery-scale]')).toHaveCount(1)
      await openProduct(page, request, ANCHORS.S11.en)
      await expect(page.locator('[data-scale-caption]')).toHaveText('For a sense of size')
    } finally {
      await set(null)
      await removeMedia([image.id])
    }
  })
})
