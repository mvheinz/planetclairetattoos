import { seekAnimations } from './helpers/capture'
import { artTags, test, type ArtSession } from './helpers/fixtures'

// SC-08 (KUNST-QA §4.3): R12 Tattoo-Flash und R11 Tattoo – laden, scrollen; Kontur je Karte bei 0/350/700 ms nach dem
// Eintritt; Desktop: Hover auf eine Flash-Karte (MI-14 auf Tattoo-Seiten ohne Übergang).

const TIMES = [0, 350, 700]
const MAX_CARDS = 4

async function cards(art: ArtSession, name: string): Promise<void> {
  const { page } = art
  const list = page.locator('[data-flash-card]')
  const n = Math.min(MAX_CARDS, await list.count())
  for (let i = 0; i < n; i++) {
    await art.pauseClock()
    await list
      .nth(i)
      .evaluate((el) =>
        el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior }),
      )
    let t = 0
    for (const at of TIMES) {
      if (at > t) await page.clock.runFor(at - t)
      t = at
      await seekAnimations(page, at)
      await art.frame(`${name}-card${i + 1}-t${String(at).padStart(4, '0')}`)
    }
    await art.resumeClock()
  }
}

test('SC-08 Tattoo und Flash', { tag: artTags('all') }, async ({ art }) => {
  const { page } = art
  for (const [name, url] of [
    ['flash', '/de/tattoo/flash'],
    ['tattoo', '/de/tattoo'],
  ] as const) {
    await art.goto(url)
    await art.settledFrame(`${name}-top`)
    await art.axe(name)
    await art.scrollRun(await page.evaluate(() => document.documentElement.scrollHeight), 1200)
    await page.evaluate(() => scrollTo(0, 0))
    await cards(art, name)
    if (art.isDesktop && (await page.locator('[data-flash-card]').count()) > 0) {
      const first = page.locator('[data-flash-card]').first()
      await first.scrollIntoViewIfNeeded()
      await first.hover()
      await page.waitForTimeout(100)
      await art.settledFrame(`${name}-hover`)
      await page.mouse.move(0, 0)
    }
  }
})
