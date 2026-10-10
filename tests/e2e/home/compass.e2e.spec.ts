import { expect, test } from '../fixtures'

// U-52 (P14.3): Stations-Kompass unter dem Kopf der Startseite – je Station Planeten-/Sternmarke und Name, reine Anker
// (`#station-…`), ohne Skript, per Tastatur bedienbar, Ziele ≥ 44 px; das Sprungziel liegt unter der klebenden Kopfleiste.

const STATIONS = ['keramik', 'textil', 'zeichnungen', 'schmuck', 'tattoo']
const NAMES = {
  de: ['Keramik', 'Textil & Caps', 'Zeichnungen', 'Schmuck', 'Tattoo'],
  en: ['Ceramics', 'Textiles & caps', 'Drawings', 'Jewellery', 'Tattoo'],
}

for (const locale of ['de', 'en'] as const) {
  test(`U-52 /${locale}: Kompass mit 5 Ankern, Marken, Ziele ≥ 44 px`, async ({ page }) => {
    await page.goto(`/${locale}`)
    const nav = page.getByRole('navigation', { name: locale === 'de' ? 'Stationen' : 'Stations' })
    await expect(nav).toHaveCount(1)
    const links = nav.getByRole('link')
    await expect(links).toHaveCount(5)
    await expect(links).toHaveText(NAMES[locale])
    for (let i = 0; i < STATIONS.length; i++) {
      const link = links.nth(i)
      await expect(link).toHaveAttribute('href', `#station-${STATIONS[i]}`)
      await expect(page.locator(`section#station-${STATIONS[i]}`)).toHaveCount(1)
      await expect(link.locator('svg[aria-hidden="true"]')).toHaveCount(1)
      const box = (await link.boundingBox())!
      expect(box.height).toBeGreaterThanOrEqual(44)
      expect(box.width).toBeGreaterThanOrEqual(44)
    }
    // unter dem Kopf, vor Foto/Koko
    const hero = (await page.locator('[data-home-hero]').boundingBox())!
    const navBox = (await nav.boundingBox())!
    expect(navBox.y).toBeGreaterThanOrEqual(hero.y + hero.height - 1)
    expect(navBox.y).toBeLessThan((await page.locator('[data-slot="chairwoman"]').boundingBox())!.y)
  })
}

test('U-52 Tastatur: Enter springt zu jeder Station, Überschrift sichtbar unter der Kopfleiste', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/de')
  const header = (await page.locator('header').first().boundingBox())!
  for (const id of [...STATIONS].reverse()) {
    const link = page.locator(`[data-home-compass] a[href="#station-${id}"]`)
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await link.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(new RegExp(`#station-${id}$`))
    const heading = page.locator(`#station-${id} h2`)
    await expect
      .poll(async () => (await heading.boundingBox())!.y, { message: id })
      .toBeGreaterThanOrEqual(header.y + header.height)
    const top = (await heading.boundingBox())!.y
    expect(top, id).toBeLessThan(page.viewportSize()!.height / 2)
  }
})

test.describe('ohne JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('U-52 Anker funktionieren ohne Skript', async ({ page }) => {
    await page.goto('/de')
    await page.locator('[data-home-compass] a[href="#station-tattoo"]').click()
    await expect(page).toHaveURL(/#station-tattoo$/)
    // (weiches Scrollen, falls erlaubt: auf das Ende warten)
    const vh = page.viewportSize()!.height
    await expect
      .poll(async () => (await page.locator('#station-tattoo h2').boundingBox())!.y)
      .toBeLessThan(vh)
    expect((await page.locator('#station-tattoo h2').boundingBox())!.y).toBeGreaterThan(0)
  })
})
