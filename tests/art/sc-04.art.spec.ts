import type { Locator } from '@playwright/test'

import { seekAnimations } from './helpers/capture'
import { artTags, test, type ArtSession } from './helpers/fixtures'

// SC-04 (KUNST-QA §4.3): R02 Shop und R05 Archiv – Reihe für Reihe scrollen; je Reihe Frames vor dem Eintritt und
// +250/+500/+900 ms (Preisschilder schwingen, MI-02); Desktop zusätzlich Hover über 2 Karten.

const TIMES = [250, 500, 900]
const MAX_ROWS = 4

async function rowsOf(cards: Locator): Promise<number[]> {
  const tops = await cards.evaluateAll((els) =>
    els.map((e) => Math.round(e.getBoundingClientRect().top + scrollY)),
  )
  return [...new Set(tops)].sort((a, b) => a - b)
}

async function rowByRow(art: ArtSession, name: string): Promise<void> {
  const { page } = art
  const rows = (await rowsOf(page.locator('[data-product-card]'))).slice(0, MAX_ROWS)
  const vh = await page.evaluate(() => innerHeight)
  await art.pauseClock()
  for (const [i, top] of rows.entries()) {
    // vor dem Eintritt: Reihe knapp unter dem Sichtbereich
    await page.evaluate((y) => scrollTo(0, y), Math.max(0, top - vh + 10))
    await art.settledFrame(`${name}-row${i + 1}-before`)
    await page.evaluate((y) => scrollTo(0, y), Math.max(0, top - vh * 0.5))
    let t = 0
    for (const at of TIMES) {
      await page.clock.runFor(at - t)
      t = at
      await seekAnimations(page, t)
      await art.frame(`${name}-row${i + 1}-t${String(at).padStart(4, '0')}`)
    }
    await art.resumeClock()
    await art.pauseClock()
  }
  await art.resumeClock()
}

test('SC-04 Shop und Archiv Reihe für Reihe', { tag: artTags('all') }, async ({ art }) => {
  const { page } = art
  for (const [name, url] of [
    ['shop', '/de/shop'],
    ['archiv', '/de/archiv'],
  ] as const) {
    await art.goto(url)
    await art.settledFrame(`${name}-top`)
    await art.axe(name)
    await rowByRow(art, name)
    // IM-04 (R1-04-05): das ganze Raster auf einem Bild – Fotos und Platzhalter nebeneinander im Passepartout. Vorher einmal
    // durchscrollen, damit die lazy Bilder geladen sind (echte Wartezeit, die Browser-Uhr kann angehalten sein).
    if (name === 'shop') {
      const height = await page.evaluate(() => document.documentElement.scrollHeight)
      for (let y = 0; y < height; y += 500) {
        await page.evaluate((top) => scrollTo(0, top), y)
        await page.waitForTimeout(120)
      }
      await page.evaluate(() => scrollTo(0, 0))
      await art.settledFrame('shop-raster-voll', { fullPage: true, scale: 'css' })
    }
    if (art.isDesktop) {
      await page.evaluate(() => scrollTo(0, 0))
      const cards = page.locator('[data-product-card]')
      for (const k of [0, 1]) {
        await cards.nth(k).scrollIntoViewIfNeeded()
        await art.pauseClock()
        await cards.nth(k).hover({ force: true })
        let t = 0
        for (const at of TIMES) {
          await page.clock.runFor(at - t)
          t = at
          await seekAnimations(page, at)
          await art.frame(`${name}-hover${k + 1}-t${String(at).padStart(4, '0')}`)
        }
        await art.resumeClock()
        await page.mouse.move(0, 0)
      }
    }
  }
})
