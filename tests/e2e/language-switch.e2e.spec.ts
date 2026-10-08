import { expect, test } from './fixtures'
import { type Page } from '@playwright/test'

import { localizedPath, ROUTE_SAMPLE_PARAMS } from '../../src/lib/routes/paths'

// P13.8 (U-47): Sprach-Umschalter „DE | EN“ in der Kopfleiste rechts neben „Menü“ – Schrift der Kopf-Links, aktive
// Sprache mit Tusche-Linie unterstrichen, Klick führt auf dieselbe Seite in der anderen Sprache (Kategorie und Stück
// über die hreflang-Alternativen der Seite), zugänglicher Name „Language: English“ / „Sprache: Deutsch“, Tastatur mit
// Fokusrahmen, 320–1440 px ohne Umbruch. Der Umschalter im Fuß führt auf dasselbe Ziel.

const switchLink = (page: Page) => page.locator('[data-site-header] [data-header-language]')

const PAIRS: { name: string; de: string; en: string }[] = [
  { name: 'Kontakt', de: localizedPath('R20', 'de'), en: localizedPath('R20', 'en') },
  { name: 'Tattoo-Preise', de: localizedPath('R14', 'de'), en: localizedPath('R14', 'en') },
  { name: 'Impressum', de: localizedPath('R21', 'de'), en: localizedPath('R21', 'en') },
  {
    name: 'Kategorie',
    de: localizedPath('R03', 'de', ROUTE_SAMPLE_PARAMS.R03!.de),
    en: localizedPath('R03', 'en', ROUTE_SAMPLE_PARAMS.R03!.en),
  },
  {
    name: 'Stück',
    de: localizedPath('R04', 'de', ROUTE_SAMPLE_PARAMS.R04!.de),
    en: localizedPath('R04', 'en', ROUTE_SAMPLE_PARAMS.R04!.en),
  },
]

test.describe('U-47 Sprach-Umschalter in der Kopfleiste', () => {
  for (const pair of PAIRS) {
    test(`${pair.name}: DE → EN → DE auf dieselbe Seite`, async ({ page }) => {
      await page.goto(pair.de)
      await expect(page.locator('html')).toHaveAttribute('lang', 'de')
      const link = switchLink(page)
      await expect(link).toBeVisible()
      await expect(link).toHaveText(/DE\s*\|\s*EN/)
      await expect(link).toHaveAttribute('aria-label', 'Language: English')
      await expect(link).toHaveAttribute('hreflang', 'en')
      await expect(link).toHaveAttribute('lang', 'en')
      await expect(link.locator('[data-active]')).toHaveText('DE')
      await expect(link.locator('[data-active] svg')).toHaveCount(1)
      // Kategorie/Stück: Ziel aus den hreflang-Alternativen (nach dem Hydrieren)
      await expect(link).toHaveAttribute('href', pair.en)
      // gleiches Ziel im Fuß
      await expect(
        page.locator('footer [data-language-switcher] a[hreflang="en"]'),
      ).toHaveAttribute('href', pair.en)
      await link.click()
      await expect(page).toHaveURL(new RegExp(`${pair.en}$`))
      await expect(page.locator('html')).toHaveAttribute('lang', 'en')
      const back = switchLink(page)
      await expect(back).toHaveAttribute('aria-label', 'Sprache: Deutsch')
      await expect(back.locator('[data-active]')).toHaveText('EN')
      await expect(back).toHaveAttribute('href', pair.de)
      await back.click()
      await expect(page).toHaveURL(new RegExp(`${pair.de}$`))
      await expect(page.locator('html')).toHaveAttribute('lang', 'de')
    })
  }

  test('Tastatur: erreichbar nach „Menü“, sichtbarer Fokusrahmen', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'Safari fokussiert Links per Tab nur mit Systemeinstellung',
    )
    await page.goto(localizedPath('R20', 'de'))
    await page.locator('[data-menu-trigger]').focus()
    await page.keyboard.press('Tab')
    const link = switchLink(page)
    await expect(link).toBeFocused()
    const outline = await link.evaluate((el) => {
      const st = getComputedStyle(el)
      return { style: st.outlineStyle, width: parseFloat(st.outlineWidth) }
    })
    expect(outline.style).not.toBe('none')
    expect(outline.width).toBeGreaterThan(0)
  })

  for (const width of [320, 375, 390, 1440] as const) {
    test(`${width} px: Kopfleiste einzeilig, kein Überlauf, Zielfläche ≥ 44 × 44`, async ({
      page,
    }) => {
      for (const path of [localizedPath('R20', 'de'), localizedPath('R20', 'en')]) {
        await page.setViewportSize({ width, height: 800 })
        await page.goto(path)
        await page.evaluate(() => document.fonts.ready)
        const m = await page.evaluate(() => {
          const header = document.querySelector('[data-site-header]')!
          const items = Array.from(header.querySelectorAll('a[href]')).map(
            (a) => a.getBoundingClientRect().top,
          )
          return {
            doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            header: header.scrollWidth - header.clientWidth,
            rows: new Set(items.map((t) => Math.round(t))).size,
          }
        })
        expect(m.doc, path).toBeLessThanOrEqual(0)
        expect(m.header, path).toBeLessThanOrEqual(0)
        expect(m.rows, `${path}: alle Kopf-Einträge in einer Zeile`).toBe(1)
        const box = (await switchLink(page).boundingBox())!
        expect(box.width).toBeGreaterThanOrEqual(44)
        expect(box.height).toBeGreaterThanOrEqual(44)
        expect(box.x + box.width).toBeLessThanOrEqual(width)
      }
    })
  }
})
