import { hiddenFrames, jankTier } from './helpers/extras'
import { artTags, test, type ArtSession } from './helpers/fixtures'

// SC-15 (KUNST-QA §4.3): R01 und R04 auf `art-pixel7` – Resize 412 → 768 → 412, Querformat, Schrift verzögert
// nachladen (Font-Anfragen 2 s blockieren); Frames vor/nach und Neuaufbau-Zähler der Linie (`__leash.rebuildCount()`).
// Für `art:check` (P9.6): Textgröße 200 % bei 390 px (LG-04), künstliche Last `?qa-jank=30` (PF-12), verborgener Tab
// (PF-11).

const rebuilds = (art: ArtSession) =>
  art.page.evaluate(
    () =>
      (window as Window & { __leash?: { rebuildCount(): number } }).__leash?.rebuildCount() ?? null,
  )

test(
  'SC-15 Resize, Querformat, verzögerte Schrift',
  { tag: artTags(['art-pixel7']) },
  async ({ art }) => {
    const { page, context } = art
    const counts: Record<string, unknown>[] = []
    const vp = page.viewportSize()!
    for (const [name, url] of [
      ['r01', '/de'],
      ['r04', '/de/shop/901'],
    ] as const) {
      await page.setViewportSize(vp)
      await art.goto(url)
      await art.settledFrame(`${name}-before`)
      const sizes: [string, { width: number; height: number }][] = [
        ['w768', { width: 768, height: vp.height }],
        ['w412', vp],
        ['landscape', { width: vp.height, height: vp.width }],
        ['portrait', vp],
      ]
      for (const [label, size] of sizes) {
        await page.setViewportSize(size)
        await page.waitForTimeout(900)
        await art.settledFrame(`${name}-${label}`)
        counts.push({ page: name, step: label, rebuilds: await rebuilds(art) })
      }
    }
    // Schrift verzögert: alle Font-Dateien 2 s zurückhalten, R01 neu laden.
    await page.setViewportSize(vp)
    await context.route(/\.(woff2?|ttf|otf)(\?|$)/, async (route) => {
      await new Promise((r) => setTimeout(r, 2000))
      await route.continue()
    })
    await page.goto('/de', { waitUntil: 'commit' })
    await page.waitForTimeout(600)
    await art.frame('r01-font-pending')
    await page.evaluate(() => document.fonts.ready)
    await art.waitLeash()
    await page.waitForTimeout(900)
    await art.settledFrame('r01-font-loaded')
    counts.push({ page: 'r01', step: 'font-delayed', rebuilds: await rebuilds(art) })
    art.json('rebuilds', counts)
    await context.unroute(/\.(woff2?|ttf|otf)(\?|$)/)

    // LG-04: Textgröße 200 % bei 390 px – kein horizontales Scrollen, LG-01 leer, Linie neu aufgebaut.
    await page.setViewportSize({ width: 390, height: 844 })
    await art.goto('/de')
    const before = await rebuilds(art)
    await page.evaluate(() => (document.documentElement.style.fontSize = '32px'))
    await page.waitForTimeout(1200)
    await art.settledFrame('font200-top')
    const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)
    await art.scrollFrame(Math.round(max / 3), 'font200-third')
    await art.scrollFrame(Math.round((2 * max) / 3), 'font200-twothirds')
    art.extra('lg04', { rebuildBefore: before, rebuildAfter: await rebuilds(art) })
    await page.setViewportSize(vp)

    if (art.reduced) return
    // PF-12: künstliche Last schaltet Stufe A → B innerhalb von 2 s Scrollen.
    art.extra('pf12', await jankTier(art))
    // PF-11: verborgener Tab – keine Engine-Frames.
    await art.goto('/de')
    art.extra('pf11', { hiddenFrames: await hiddenFrames(page) })
  },
)
