import { artTags, test, type ArtSession } from './helpers/fixtures'

// SC-15 (KUNST-QA §4.3): R01 und R04 auf `art-pixel7` – Resize 412 → 768 → 412, Querformat, Schrift verzögert
// nachladen (Font-Anfragen 2 s blockieren); Frames vor/nach und Neuaufbau-Zähler der Linie (`__leash.rebuildCount()`).

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
  },
)
