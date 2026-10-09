import { expect, test, type Page } from '@playwright/test'

import { overlaps } from '../../scripts/art/lib/checks/runtime'
import { localizedPath } from '../../src/lib/routes/paths'
import { probePage } from '../art/helpers/probe'
import { waitForLeashSettled } from './leashSettle'

// U-44 (P13.5): Auf allen Shop- und Tattoo-Seiten läuft Coco an der Leine mit – Kringel zwischen den Blöcken, ab und zu
// eine Umrundung einer Bildgruppe (DESIGN §9.7). Geprüft je Seite an 14 Lesezeilen-Positionen: Linie und Hundekante
// überdecken keinen Text und kein Bedienelement (KUNST-QA LG-01), Coco ist an der Leine platziert und die Linie reicht
// nie über sie hinaus (Coco läuft vorn). Engine-Prüfungen in Chromium (Pixel 7 und Desktop), Debug-Build (`__leash`).

type LeashWindow = Window & {
  __leash?: {
    geometry: {
      totalLength: number
      scrollMap: { readingY: number }[]
      stations: { id: string; loop: string }[]
    }
    drawnLen(): number
    cocoLen(): number
    setReadingY(y: number | null): void
  }
  __artReadingY?: number | null
}

// tsx ergänzt in Browser-Callbacks `__name(…)` (esbuild keepNames) – im Browser als Identität bereitstellen.
const NAME_SHIM = 'globalThis.__name = globalThis.__name || ((f) => f);'

test.beforeEach(async ({ page, browserName }, testInfo) => {
  test.skip(
    browserName !== 'chromium' || testInfo.project.name === 'iphone-15',
    'Engine-Prüfungen in Chromium (Pixel 7 und Desktop)',
  )
  await page.addInitScript(NAME_SHIM)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
})

async function waitForLeash(page: Page) {
  await page.waitForFunction(
    () => {
      const l = (window as LeashWindow).__leash
      return !!l?.geometry && l.geometry.totalLength > 0
    },
    null,
    { timeout: 30_000 },
  )
}

/** Erste Produkt- und Kategorie-Adresse aus dem Shop (Beispielbestand). */
async function shopLinks(page: Page) {
  await page.goto(localizedPath('R02', 'de'))
  return page.evaluate(() => ({
    product: document.querySelector<HTMLAnchorElement>('ul[data-behavior] li a[href*="/shop/"]')!
      .pathname,
    category: [...document.querySelectorAll<HTMLAnchorElement>('a[data-chip]')]
      .map((a) => a.pathname)
      .find((p) => p.includes('/kategorie/'))!,
  }))
}

const ROUTES = ['R02', 'R05', 'R10', 'R11', 'R12', 'R14', 'R15', 'R16', 'R17', 'R18'] as const

test('U-44: Coco läuft auf allen Shop- und Tattoo-Seiten mit, ohne Text oder Bedienelemente zu überdecken (LG-01)', async ({
  page,
}) => {
  test.setTimeout(240_000)
  const links = await shopLinks(page)
  const paths = [
    ...ROUTES.map((id) => localizedPath(id, 'de')),
    links.product,
    links.category,
    localizedPath('R11', 'en'),
  ]
  const hits: string[] = []
  for (const path of paths) {
    await page.goto(path)
    await waitForLeash(page)
    // Intro (MI-10, 1800 ms) abwarten – bis Linie und Coco ruhen (P14.13, statt fester 2,2 s)
    await waitForLeashSettled(page)
    const coco = page.locator('.coco[data-leash-coco]')
    await expect(coco, path).toHaveAttribute('data-placed', '')
    await expect(coco, path).toBeVisible()
    const range = await page.evaluate(() => {
      const sm = (window as LeashWindow).__leash!.geometry.scrollMap
      return { a: sm[0]!.readingY, b: sm[sm.length - 1]!.readingY }
    })
    for (let i = 0; i <= 13; i++) {
      const y = range.a + ((range.b - range.a) * i) / 13
      const before = await page.evaluate(() => (window as LeashWindow).__leash!.drawnLen())
      await page.evaluate((y) => {
        const w = window as LeashWindow
        const layer = document.querySelector('[data-leash-layer]')
        const top = layer ? layer.getBoundingClientRect().top + scrollY : 0
        scrollTo(0, Math.max(0, y + top - 0.72 * innerHeight))
        w.__artReadingY = y
        w.__leash!.setReadingY(y)
      }, y)
      await page.waitForTimeout(450)
      const p = await probePage(page, {
        label: `${path} y${Math.round(y)}`,
        frame: null,
        t: null,
        scale: 1,
        calm: false,
      })
      expect(p.leash, `${path}: Linie gemessen`).not.toBeNull()
      hits.push(...overlaps(p).map((o) => `${p.label}: ${o}`))
      // Coco läuft vorn: wächst die Linie, dann nur bis zu ihr (nie über sie hinaus)
      const { drawn, at } = await page.evaluate(() => {
        const l = (window as LeashWindow).__leash!
        return { drawn: l.drawnLen(), at: l.cocoLen() }
      })
      if (drawn > before + 1) expect(drawn - at, `${p.label}: Linie vor Coco`).toBeLessThan(2)
    }
  }
  expect(hits).toEqual([])
})

test('U-44: Umrundungen – Kategorie-Bilder im Shop und Galerie-Leiste auf R11 (ab 768 px), Kringel je Kartenzeile', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Umrundungen brauchen Platz (Desktop)')
  const loops = async (path: string) => {
    await page.goto(path)
    await waitForLeash(page)
    return page.evaluate(() =>
      Object.fromEntries(
        (window as LeashWindow).__leash!.geometry.stations.map((s) => [s.id, s.loop]),
      ),
    )
  }
  const shop = await loops(localizedPath('R02', 'de'))
  expect(shop.kategorien).toBe('contour')
  expect(Object.keys(shop).filter((id) => id.startsWith('row-')).length).toBeGreaterThan(1)
  const tattoo = await loops(localizedPath('R11', 'de'))
  expect(tattoo.gallery).toBe('contour')
  expect(tattoo['tattoo-title']).toBe('right')
})
