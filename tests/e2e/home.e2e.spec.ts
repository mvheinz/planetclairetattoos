import { expect, test, type Page } from '@playwright/test'

import type { Locale } from '../../src/lib/routes/registry'

// P2.20 Startseite R01 (KONZEPT §3.1, DESIGN KO-21/§11.4): Kopf-Station „Planet Claire“ und genau 7 Stationen aus dem
// Seed `pages:home` (AK-3-01, AK-SEED-18), ohne JavaScript vollständig lesbar, DE und EN vollständig, Linie zeichnet
// beim Scrollen (AK-DS-13), Tempo-Budget mobil (LCP < 2,5 s, CLS < 0,1). DM-PAGE-01 (fehlende Seite → Leerzustand)
// prüft `tests/int/pages/home-data.int.spec.ts` – hier würde das Löschen der Seite parallele Specs stören.

const STATION_IDS = [
  'hallo',
  'keramik',
  'textil',
  'zeichnungen',
  'schmuck',
  'tattoo',
  'jutta-und-coco',
]

const HEADINGS: Record<Locale, string[]> = {
  de: ['Hallo!', 'Keramik', 'Textil & Caps', 'Zeichnungen', 'Schmuck', 'Tattoo', 'Jutta & Coco'],
  en: ['Hi!', 'Ceramics', 'Textiles & caps', 'Drawings', 'Jewellery', 'Tattoo', 'Jutta & Coco'],
}

const HERO: Record<Locale, string> = {
  de: 'Tattoos & handgemachte Unikate aus Berlin',
  en: 'Tattoos & handmade one-offs from Berlin',
}

async function expectStations(page: Page, locale: Locale) {
  await expect(page.locator('h1')).toHaveCount(1)
  await expect(page.locator('h1')).toHaveText('Planet Claire')
  await expect(page.locator('[data-home-hero]')).toContainText(HERO[locale])
  const stations = page.locator('[data-home-station]')
  await expect(stations).toHaveCount(7)
  expect(
    await stations.evaluateAll((els) => els.map((el) => el.getAttribute('data-home-station'))),
  ).toEqual(STATION_IDS)
  await expect(stations.locator('h2')).toHaveText(HEADINGS[locale])
  await expect(stations.first()).toContainText('Station 01')
  await expect(stations.last()).toContainText('Station 07')
}

test.describe('Startseite @smoke', () => {
  for (const locale of ['de', 'en'] as const) {
    test(`AK-3-01 AK-SEED-18 /${locale}: Kopf-Station und 7 Stationen in fester Reihenfolge @smoke`, async ({
      page,
    }) => {
      const res = await page.goto(`/${locale}`)
      expect(res?.status()).toBe(200)
      await expect(page.locator('body')).toHaveAttribute('data-preset', 'journey')
      await expectStations(page, locale)
      // Anker der Linie: Planet-Marke (orbit) und je Station ein Anker mit Coco-Pose.
      await expect(page.locator('[data-leash-station="planet-claire"]')).toHaveAttribute(
        'data-leash-loop',
        'orbit',
      )
      for (const id of STATION_IDS) {
        await expect(page.locator(`[data-leash-station="${id}"]`)).toHaveCount(1)
      }
      await expect(page.locator('[data-leash-station="keramik"]')).toHaveAttribute(
        'data-leash-pose',
        'sniff',
      )
      // Noch keine Produktkarten (W-33); Links „Alle …“ zu den Bereichen.
      await expect(page.locator('[data-home-station] article, [data-product-card]')).toHaveCount(0)
      const keramikLink = page.locator('[data-home-station="keramik"] a')
      await expect(keramikLink).toHaveAttribute(
        'href',
        locale === 'de' ? '/de/shop/kategorie/keramik' : '/en/shop/category/ceramics',
      )
      // Organization-JSON-LD (P2.11).
      const ld = await page.locator('script[type="application/ld+json"]').first().textContent()
      expect(JSON.parse(ld ?? '{}')['@type']).toBe('Organization')
    })
  }

  test('AK-DS-13 die Linie zeichnet beim Scrollen und erreicht alle Stationen @smoke', async ({
    page,
    browserName,
  }, testInfo) => {
    test.skip(
      browserName !== 'chromium' || testInfo.project.name !== 'desktop',
      'Engine-Prüfung in Chromium genügt (DESIGN §9.13)',
    )
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/de')
    await page.waitForFunction(() => {
      const l = (window as Window & { __leash?: { geometry: unknown } }).__leash
      return !!l?.geometry
    })
    await page.waitForTimeout(1200)
    const drawn = () =>
      page.evaluate(() =>
        (window as unknown as { __leash: { drawnLen(): number } }).__leash.drawnLen(),
      )
    const before = await drawn()
    expect(await page.locator('[data-leash-reached]').count()).toBeLessThan(8)
    const height = await page.evaluate(() => document.documentElement.scrollHeight)
    for (let y = 0; y <= height; y += 300) {
      await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y)
      await page.waitForTimeout(40)
    }
    await expect.poll(drawn).toBeGreaterThan(before)
    await expect(page.locator('[data-leash-reached]')).toHaveCount(8)
  })

  test('Tempo mobil: LCP < 2,5 s, CLS < 0,1 @smoke', async ({ page, browserName }, testInfo) => {
    test.skip(
      browserName !== 'chromium' || testInfo.project.name === 'desktop',
      'mobile Projekte (Chromium) messen',
    )
    await page.goto('/de')
    await page.waitForLoadState('load')
    await page.waitForTimeout(2500)
    const { lcp, cls } = await page.evaluate(
      () =>
        new Promise<{ lcp: number; cls: number }>((resolve) => {
          let lcp = 0
          let cls = 0
          new PerformanceObserver((list) => {
            for (const e of list.getEntries()) lcp = Math.max(lcp, e.startTime)
          }).observe({ type: 'largest-contentful-paint', buffered: true })
          new PerformanceObserver((list) => {
            for (const e of list.getEntries() as (PerformanceEntry & {
              value: number
              hadRecentInput: boolean
            })[])
              if (!e.hadRecentInput) cls += e.value
          }).observe({ type: 'layout-shift', buffered: true })
          setTimeout(() => resolve({ lcp, cls }), 300)
        }),
    )
    expect(lcp).toBeGreaterThan(0)
    expect(lcp).toBeLessThan(2500)
    expect(cls).toBeLessThan(0.1)
  })
})

test.describe('Schriften-Tor (DESIGN §4.1, P2.20)', () => {
  test('Webschriften erst nach dem ersten Bild angefordert, danach aktiv; kein Preload', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'Paint Timing (first-contentful-paint) nur in Chromium verlässlich',
    )
    await page.goto('/de')
    await page.waitForLoadState('load')
    await expect(page.locator('html')).not.toHaveAttribute('data-fonts')
    await page.evaluate(() => document.fonts.ready)
    const r = await page.evaluate(() => {
      const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? -1
      const fonts = performance
        .getEntriesByType('resource')
        .filter((e) => e.name.endsWith('.woff2'))
        .map((e) => e.startTime)
      const family = getComputedStyle(document.querySelector('h1')!).fontFamily
      return {
        fcp,
        fonts,
        family,
        preload: document.querySelectorAll('link[rel=preload][as=font]').length,
      }
    })
    expect(r.preload).toBe(0)
    expect(r.fcp).toBeGreaterThan(0)
    expect(r.fonts.length).toBeGreaterThanOrEqual(2)
    for (const start of r.fonts) expect(start).toBeGreaterThan(r.fcp)
    expect(r.family).toMatch(/^["']?mansalva["']?,/i)
    expect(await page.evaluate(() => document.fonts.check('400 16px mansalva'))).toBe(true)
  })
})

test.describe('Startseite ohne JavaScript @smoke', () => {
  test.use({ javaScriptEnabled: false })

  for (const locale of ['de', 'en'] as const) {
    test(`AK-3-01 /${locale}: Inhalt ohne JavaScript vollständig lesbar @smoke`, async ({
      page,
    }) => {
      await page.goto(`/${locale}`)
      await expectStations(page, locale)
      for (const station of await page.locator('[data-home-station]').all()) {
        await expect(station.locator('h2')).toBeVisible()
        await expect(station.locator('p').nth(1)).toBeVisible()
      }
    })
  }
})
