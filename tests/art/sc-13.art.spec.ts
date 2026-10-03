import { artTags, test } from './helpers/fixtures'

// SC-13 (KUNST-QA §4.3): `/de/qa/art` – Stationszeichnungen neben ihrer Quelle, Platzhalter, Weltraum-Motive, Wortmarke,
// Favicon, OG-Bilder als Standbilder in 1× (Profil `art-desktop`) und 3× (zusätzlicher Kontext mit DPR 3).

const SECTIONS = ['stations', 'placeholders', 'space', 'wordmark', 'favicon', 'og'] as const

test('SC-13 Zeichnungen und Motive', { tag: artTags(['art-desktop']) }, async ({ art }) => {
  await art.goto('/de/qa/art', { waitLeash: false })
  for (const s of SECTIONS) {
    const el = art.page.locator(`[data-qa-section="${s}"]`)
    await el.scrollIntoViewIfNeeded()
    await art.frame(`${s}-1x`, { element: el })
  }
  const ctx = await art.extraContext({ deviceScaleFactor: 3 })
  try {
    const page = await ctx.newPage()
    await page.goto('/de/qa/art', { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready)
    for (const s of ['stations', 'space', 'wordmark', 'favicon'] as const) {
      const el = page.locator(`[data-qa-section="${s}"]`)
      await el.scrollIntoViewIfNeeded()
      await art.frame(`${s}-3x`, { element: el })
    }
  } finally {
    await ctx.close()
  }
})
