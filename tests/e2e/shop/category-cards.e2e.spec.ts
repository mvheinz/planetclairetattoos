import { localizedPath } from '../../../src/lib/routes/paths'
import { expect, test } from '../fixtures'

// P12.15 Kategorie-Karten im Shop: Coco-Kachel über dem Etikett, alle Karten exakt gleich groß (nur lesend).
for (const locale of ['de', 'en'] as const) {
  test(`Kategorie-Karten gleich groß, Bilder geladen, Links funktionieren (${locale})`, async ({
    page,
  }, testInfo) => {
    await page.goto(localizedPath('R02', locale))
    const cards = page.locator('nav a[data-chip]:has(img[data-tile])')
    expect(await cards.count()).toBeGreaterThanOrEqual(3)
    await expect(cards.first()).toHaveText(locale === 'de' ? 'Alle' : 'All')

    const boxes = await cards.evaluateAll((els) =>
      els.map((e) => {
        const a = e.getBoundingClientRect()
        const i = e.querySelector('img')!.getBoundingClientRect()
        return { w: a.width, h: a.height, iw: i.width, ih: i.height }
      }),
    )
    for (const b of boxes) {
      expect(b).toEqual(boxes[0])
      expect(b.iw).toBeCloseTo(b.ih, 1) // quadratisch
    }

    const imgs = page.locator('img[data-tile]')
    for (let i = 0; i < (await imgs.count()); i++) {
      await imgs.nth(i).scrollIntoViewIfNeeded()
      await expect
        .poll(() => imgs.nth(i).evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0))
        .toBe(true)
    }
    await expect(imgs.first()).toHaveAttribute('alt', '')

    // Kein horizontales Scrollen der Seite.
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)

    // Tastatur: Fokusring auf der ganzen Karte, Link führt zur Kategorie.
    const second = cards.nth(1)
    const href = await second.getAttribute('href')
    await second.focus()
    await expect(second).toBeFocused()
    expect(await second.evaluate((e) => getComputedStyle(e).outlineStyle)).toBe('solid')
    await second.click()
    await expect(page).toHaveURL(new RegExp(`${href!.split('?')[0]}$`))
    await expect(page.locator('a[data-chip][aria-current="page"]')).toHaveCount(1)
    if (testInfo.project.name === 'desktop') {
      await page.screenshot({ path: testInfo.outputPath(`cards-${locale}.png`) })
    }
  })
}
