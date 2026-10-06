import { expect, test } from './fixtures'

import { localizedPath } from '../../src/lib/routes/paths'
import { LOCALES } from '../../src/lib/routes/registry'
import { expectCalm } from './calm'

// P2.13 Rechtsseiten-Gerüste R21–R25, R27 (KONZEPT §3.14): serverseitig aus `legal-texts` (Grund-Seed-Platzhalter),
// genau eine `h1` (R-010), ohne JavaScript lesbar, kein rohes Token, Platzhalter-Band (R-002), Ruhe-Modus (AK-DS-11).

const LEGAL_TEXT_ROUTES = ['R21', 'R22', 'R23', 'R24', 'R25'] as const
const ALL_ROUTES = [...LEGAL_TEXT_ROUTES, 'R27'] as const

const BANNER = {
  de: 'PLATZHALTER – nicht rechtsverbindlich',
  en: 'PLACEHOLDER – not legally binding',
}

test.describe('Rechtsseiten @smoke', () => {
  for (const locale of LOCALES) {
    for (const id of ALL_ROUTES) {
      const path = localizedPath(id, locale)
      test(`R-010 R-002 AK-DS-11 ${id} ${path}: 200, eine h1, kein Token, Band, ruhig @smoke`, async ({
        page,
      }) => {
        const res = await page.goto(path)
        expect(res?.status(), path).toBe(200)
        await expect(page.locator('h1')).toHaveCount(1)
        await expect(page.locator('body')).toHaveAttribute('data-preset', 'legal')
        const html = await page.content()
        expect(html, 'rohes Token im HTML').not.toContain('{{')

        const banner = page.locator('[data-placeholder-banner]')
        if (id === 'R27') {
          // Konformität: kein Rechtstext der Kanzlei, Liste oder neutraler Satz (KONZEPT §3.14).
          await expect(
            page.locator('[data-conformity-list], [data-conformity-empty]').first(),
          ).toBeVisible()
        } else {
          await expect(banner).toHaveCount(1)
          await expect(banner).toBeVisible()
          await expect(banner).toHaveText(BANNER[locale])
          // Banner oben: vor der Überschrift.
          const bannerFirst = await page.evaluate(() => {
            const b = document.querySelector('[data-placeholder-banner]')
            const h = document.querySelector('main h1')
            return !!b && !!h && !!(b.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING)
          })
          expect(bannerFirst, 'Band steht über der h1').toBe(true)
          await expect(page.locator('[data-legal-text]').first()).toBeVisible()
          // Datum der gültigen Fassung (der Grund-Seed gilt ab 1. Januar 2026; P6.4-Tests veröffentlichen neuere).
          await expect(page.locator('[data-legal-as-of]').first()).toContainText(
            locale === 'de' ? /Stand: \d{1,2}\. \S+ 20\d\d/ : /Version: \S+ \d{1,2}, 20\d\d/,
          )
          if (locale === 'en') {
            // Grund-Seed hat nur deutsche Platzhalter → deutscher Text mit Hinweis (R-015).
            await expect(page.getByText('Only available in German.').first()).toBeVisible()
          }
        }
        await expectCalm(page, path)
      })
    }
  }

  test('R-012 Impressum: Tokens aus den Einstellungen ersetzt @smoke', async ({ page }) => {
    await page.goto('/de/impressum')
    const text = page.locator('[data-legal-text="impressum"]')
    await expect(text).toContainText('Planet Claire')
    await expect(text).toContainText('jutta@planetclairetattoos.com')
    await expect(text.locator('h2').first()).toHaveText('Anbieterin')
  })

  test('R24 zeigt Belehrung, Muster-Formular und den Link „Vertrag widerrufen“ (R-090) @smoke', async ({
    page,
  }) => {
    await page.goto('/de/widerrufsbelehrung')
    await expect(page.locator('[data-legal-text="widerrufsbelehrung"]')).toBeVisible()
    await expect(page.locator('[data-legal-text="widerrufsformular"]')).toBeVisible()
    await expect(page.locator('[data-legal-text="widerrufsbelehrung"]')).toContainText(
      '/de/vertrag-widerrufen',
    )
    const cta = page.locator('main [data-withdraw-cta]')
    await expect(cta).toHaveText('Vertrag widerrufen')
    await expect(cta).toHaveAttribute('href', '/de/vertrag-widerrufen')
  })
})

test.describe('Rechtsseiten ohne JavaScript @smoke', () => {
  test.use({ javaScriptEnabled: false })

  for (const locale of LOCALES) {
    test(`R-010 ${locale}: Textkörper und Band ohne JavaScript sichtbar @smoke`, async ({
      page,
    }) => {
      for (const id of ALL_ROUTES) {
        const path = localizedPath(id, locale)
        expect((await page.goto(path))?.status(), path).toBe(200)
        await expect(page.locator('h1'), path).toBeVisible()
        if (id === 'R27') {
          await expect(
            page.locator('[data-conformity-list], [data-conformity-empty]').first(),
            path,
          ).toBeVisible()
        } else {
          await expect(page.locator('[data-placeholder-banner]'), path).toBeVisible()
          await expect(page.locator('[data-legal-text]').first(), path).toContainText(
            'Text folgt von der Kanzlei.',
          )
        }
      }
    })
  }
})
