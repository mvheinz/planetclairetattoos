import type { Page } from '@playwright/test'

import { ADMIN_VIEWS } from '../../../src/admin/views/registry'
import { hasSamplePath, pageRoutes, samplePath } from '../../../src/lib/routes/paths'
import { LOCALES } from '../../../src/lib/routes/registry'
import { adminRoute } from '../../helpers/adminEnv'
import { expectNoSeriousViolations } from '../axe'
import { expect, test } from '../fixtures'

// P10.3 Barrierefreiheits-Audit (T-11, EK-07, R-191, AK-DS-14): über jede Registry-Route DE/EN – 200 % Schriftgröße bei
// 390 px ohne horizontales Scrollen, erzwungene Farben (forced-colors), reduzierte Bewegung ohne laufende Animation und
// Alt-Texte aller sichtbaren Bilder – und jede Hauptansicht der Verwaltung auf dem Handy (390 px). Die axe-Läufe je Route
// und Zustand (leer, Fehler, reserviert, verkauft, offenes Menü) stehen in `a11y.e2e.spec.ts`, der Tastatur-Durchlauf in
// `keyboard.e2e.spec.ts` und `a11y/keyboard.e2e.spec.ts`. Die Viewport-Größen sind hier fest; deshalb nur im Projekt `desktop`.

test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop',
    'Feste Viewports (390 px bzw. Forced-Colors): ein Projekt genügt',
  )
})

const livePages = pageRoutes().filter((r) => r.status === 'live' && hasSamplePath(r))

async function settle(page: Page) {
  await page.waitForLoadState('networkidle')
}

const horizontalOverflow = (page: Page) =>
  page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }))

test.describe('Schriftgröße 200 % bei 390 px @a11y', () => {
  for (const route of livePages) {
    test(`EK-07 ${route.id} DE/EN: 200 % Schrift, kein waagerechtes Scrollen`, async ({ page }) => {
      test.slow()
      await page.setViewportSize({ width: 390, height: 844 })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      for (const locale of LOCALES) {
        const url = samplePath(route.id, locale)
        await page.goto(url)
        await settle(page)
        // Browser-Textgröße 200 % ≙ Wurzelschrift 200 % (alle Größen sind in rem).
        await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
        await page.evaluate(() => document.fonts.ready)
        const { scroll, client } = await horizontalOverflow(page)
        expect(scroll, `${url}: scrollWidth ${scroll} > clientWidth ${client}`).toBeLessThanOrEqual(
          client + 1,
        )
        // Hauptnavigation bleibt erreichbar: der Menü-Knopf ist sichtbar und liegt im Bild.
        const trigger = page.locator('[data-site-header] [data-menu-trigger]')
        await expect(trigger, url).toBeVisible()
        const box = (await trigger.boundingBox())!
        expect(box.x + box.width, `${url}: Menü-Knopf im Bild`).toBeLessThanOrEqual(client + 1)
      }
    })
  }
})

test.describe('Erzwungene Farben (forced-colors) @a11y', () => {
  for (const route of livePages) {
    test(`R-191 ${route.id} DE/EN: Inhalt, Menü und Pflichtlink bleiben sichtbar und bedienbar`, async ({
      page,
    }) => {
      test.slow()
      await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' })
      for (const locale of LOCALES) {
        const url = samplePath(route.id, locale)
        await page.goto(url)
        await settle(page)
        expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches), url).toBe(
          true,
        )
        await expect(page.locator('h1').first(), url).toBeVisible()
        await expect(page.locator('[data-site-header] [data-menu-trigger]'), url).toBeVisible()
        const widerruf = page.locator('footer a[href*="widerruf"], footer a[href*="withdraw"]')
        await expect(widerruf.first(), url).toBeVisible()
        // Links und Knöpfe behalten eine Größe und eine eigene Kontur bzw. Unterstreichung (nicht „unsichtbar“).
        const hidden = await page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>('main a[href], main button')]
            .filter((el) => {
              const r = el.getBoundingClientRect()
              const s = getComputedStyle(el)
              return (
                s.visibility !== 'hidden' &&
                s.display !== 'none' &&
                r.width > 0 &&
                r.height > 0 &&
                s.opacity === '0'
              )
            })
            .map((el) => el.textContent?.trim().slice(0, 30)),
        )
        expect(hidden, `${url}: unsichtbare Bedienelemente`).toEqual([])
        await expectNoSeriousViolations(page, `${url} (forced-colors)`)
      }
    })
  }
})

test.describe('prefers-reduced-motion auf allen Routen @a11y', () => {
  for (const route of livePages) {
    test(`AK-DS-14 ${route.id} DE/EN: nach load + 1500 ms läuft keine Animation, keine Maske`, async ({
      page,
    }) => {
      test.slow()
      await page.emulateMedia({ reducedMotion: 'reduce' })
      for (const locale of LOCALES) {
        const url = samplePath(route.id, locale)
        await page.goto(url)
        await settle(page)
        await page.waitForTimeout(1500)
        const state = await page.evaluate(() => ({
          running: document
            .getAnimations()
            .filter((a) => a.playState === 'running')
            .map((a) => (a as CSSAnimation).animationName ?? a.id ?? 'animation'),
          masks: document.querySelectorAll('svg [mask]').length,
        }))
        expect(state.running, `${url}: laufende Animationen`).toEqual([])
        expect(state.masks, `${url}: mask-Attribute`).toBe(0)
      }
    })
  }
})

test.describe('Alt-Texte der öffentlichen Bilder DE/EN @a11y', () => {
  for (const route of livePages) {
    test(`R-191 R-042 ${route.id} DE/EN: jedes Bild hat einen Alt-Text oder ist als Zierde ausgezeichnet`, async ({
      page,
    }) => {
      test.slow()
      for (const locale of LOCALES) {
        const url = samplePath(route.id, locale)
        await page.goto(url)
        await settle(page)
        const images = await page.evaluate(() =>
          [...document.querySelectorAll('img')].map((img) => ({
            src: img.getAttribute('src') ?? '',
            alt: img.getAttribute('alt'),
            decorative:
              img.getAttribute('alt') === '' ||
              img.getAttribute('role') === 'presentation' ||
              img.getAttribute('role') === 'none' ||
              img.closest('[aria-hidden="true"]') !== null,
          })),
        )
        for (const img of images) {
          expect(img.alt, `${url}: ${img.src} ohne alt-Attribut`).not.toBeNull()
          if (!img.decorative) {
            expect(img.alt!.trim().length, `${url}: ${img.src} leerer Alt-Text`).toBeGreaterThan(0)
            // kein Dateiname als Alt-Text
            expect(img.alt, `${url}: Alt-Text ist ein Dateiname`).not.toMatch(
              /\.(jpe?g|png|webp|avif|svg)$/i,
            )
          }
        }
        // Produktbilder (Galerie, Karten) sind nie Zierde: Alt-Text in der Sprache der Seite (R-042)
        const product = await page.evaluate(() =>
          [...document.querySelectorAll('[data-gallery] img, [data-product-card] img')].map((i) =>
            i.getAttribute('alt'),
          ),
        )
        for (const alt of product) expect((alt ?? '').trim().length, url).toBeGreaterThan(3)
      }
    })
  }

  test('R-042 Produktseite: Alt-Text DE und EN unterscheiden sich (Übersetzung vorhanden)', async ({
    page,
  }) => {
    const altOf = async (url: string) => {
      await page.goto(url)
      return page.locator('[data-gallery-slide="0"] img').first().getAttribute('alt')
    }
    const de = await altOf('/de/shop/901-schale-langohr-wuschel')
    const en = await altOf('/en/shop/901-bowl-long-ears-fluff')
    expect(de).toBeTruthy()
    expect(en).toBeTruthy()
    expect(en).not.toBe(de)
  })
})

test.describe('Verwaltung auf dem Handy (390 px) @a11y', () => {
  test('T-11 Anmeldeseite: axe ohne serious/critical, kein waagerechtes Scrollen', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${adminRoute}/login`)
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await settle(page)
    const { scroll, client } = await horizontalOverflow(page)
    expect(scroll).toBeLessThanOrEqual(client + 1)
    await expectNoSeriousViolations(page, 'Verwaltung Login 390 px')
  })

  test('T-11 jede Hauptansicht der Verwaltung bei 390×844: axe, kein waagerechtes Scrollen, Leiste unten', async ({
    adminPage,
  }) => {
    test.setTimeout(10 * 60_000)
    await adminPage.setViewportSize({ width: 390, height: 844 })
    for (const view of ADMIN_VIEWS) {
      const path = `${adminRoute}${view.path}`
      await adminPage.goto(path)
      await expect(adminPage.locator('h1').first(), path).toBeVisible()
      await settle(adminPage)
      const { scroll, client } = await horizontalOverflow(adminPage)
      expect(scroll, `${path}: scrollWidth ${scroll} > clientWidth ${client}`).toBeLessThanOrEqual(
        client + 1,
      )
      await expectNoSeriousViolations(adminPage, `Verwaltung ${view.key} ${path} 390 px`)
    }
  })
})
