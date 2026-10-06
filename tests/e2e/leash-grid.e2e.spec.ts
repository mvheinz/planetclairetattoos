import { type Page } from '@playwright/test'

import { expect, test } from './fixtures'

// U-07a (P12.4): Raster-Seiten (Flash, Shop, Kategorie/Archiv) – die Leine läuft in der Rinne am Seitenrand, kringelt
// sich zwischen den Zeilen und wickelt nie eine Karte ein (KUNST-QA LG-01). Geprüft in Chromium gegen die gemessene
// Geometrie der Engine (`__leash`, nur Debug-Build) und die echten Kartenrechtecke.

type Win = Window & {
  __leash?: { geometry: { lut: ArrayLike<number>; totalLength: number } | null }
}

async function lineAndCards(page: Page, cardSelector: string) {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.waitForFunction(() => !!(window as Win).__leash?.geometry?.totalLength, null, {
    timeout: 30_000,
  })
  return page.evaluate((sel) => {
    const g = (window as Win).__leash!.geometry!
    const layer = document.querySelector('[data-leash-layer]')!.getBoundingClientRect()
    const pts: [number, number][] = []
    for (let i = 0; i < g.lut.length; i += 4) pts.push([g.lut[i + 1]!, g.lut[i + 2]!])
    const cards = [...document.querySelectorAll(sel)].map((el) => {
      const r = el.getBoundingClientRect()
      return { x: r.left - layer.left, y: r.top - layer.top, w: r.width, h: r.height }
    })
    return { pts, cards, rootH: layer.height }
  }, cardSelector)
}

const PAGES: { name: string; url: string; card: string }[] = [
  { name: 'Flash', url: '/de/tattoo/flash', card: '[data-flash-card]' },
  { name: 'Shop', url: '/de/shop', card: 'ul[data-behavior*="price-tag-swing"] > li' },
]

for (const viewport of [
  { name: '390 px', width: 390, height: 844 },
  { name: '1280 px', width: 1280, height: 900 },
]) {
  for (const p of PAGES) {
    test(`LG-01 ${p.name} (${viewport.name}): Leine nie in einer Karte, nur in der Rinne am Rand`, async ({
      page,
      browserName,
    }, testInfo) => {
      test.skip(
        browserName !== 'chromium' || testInfo.project.name !== 'desktop',
        'Engine-Prüfungen in Chromium (ein Projekt genügt)',
      )
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto(p.url)
      const { pts, cards } = await lineAndCards(page, p.card)
      expect(cards.length).toBeGreaterThan(2)
      expect(pts.length).toBeGreaterThan(20)
      const hits = pts.filter(([x, y]) =>
        cards.some((c) => x > c.x - 1 && x < c.x + c.w + 1 && y > c.y - 1 && y < c.y + c.h + 1),
      )
      expect(hits, 'Linienpunkte innerhalb von Karten').toEqual([])
      // alle Punkte (unterhalb der ersten Karte) links des Kartenrasters, in der Rinne
      const gridLeft = Math.min(...cards.map((c) => c.x))
      const firstTop = Math.min(...cards.map((c) => c.y))
      for (const [x, y] of pts)
        if (y > firstTop) expect(x, `y=${Math.round(y)}`).toBeLessThan(gridLeft)
      // kringelt sich: zwischen den Karten läuft die Linie mindestens einmal rückwärts (Schlaufe)
      const back = pts.filter(([, y], i) => i > 0 && y < pts[i - 1]![1] - 0.05).length
      expect(back).toBeGreaterThan(6)
    })
  }
}
