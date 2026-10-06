import { desktopMeasures, tabOrder } from './helpers/extras'
import { artTags, test } from './helpers/fixtures'

// SC-00 (KUNST-QA §4.3): Rauchtest der Aufnahme – Startseite laden, einmal bis unten scrollen. Video, 3 Frames.
// Dazu für `art:check` (P9.6): axe (A11Y-04), Schalter „Animationen“ (A11Y-02: vor dem Klick kein Speicher, danach
// Stillstand wie `reduced`) und Tab-Reihenfolge mit/ohne Engine (A11Y-03).
test('SC-00 Startseite laden und bis unten scrollen', { tag: artTags('all') }, async ({ art }) => {
  const { page } = art
  await art.goto('/de')
  await art.frame('top')
  await art.axe('r01')
  const bottom = await page.evaluate(() =>
    Math.max(0, document.documentElement.scrollHeight - innerHeight),
  )
  await art.scrollRun(bottom, 1500)
  await art.scrollFrame(Math.round(bottom / 2), 'middle')
  await art.scrollFrame(bottom, 'bottom')

  if (art.reduced) return
  // A11Y-02: Schalter im Fußbereich (DESIGN §11.7).
  const toggle = page.locator('footer button:has([data-motion-state])').first()
  if ((await toggle.count()) > 0) {
    await art.probe('toggle-before')
    await toggle.click()
    await page.waitForTimeout(1600)
    await art.probe('toggle-after')
    art.extra('a11y02', {
      motion: await page.evaluate(() => document.documentElement.getAttribute('data-motion')),
    })
    await toggle.click()
  } else art.extra('a11y02', { motion: null, missing: true })

  // PF-03/PF-04 Desktop 1× (ohne Playwright-Uhr).
  if (art.isDesktop) art.extra('desktopMeasures', await desktopMeasures(art))

  // A11Y-03: Tab-Reihenfolge mit und ohne Engine (`?leash=off`).
  if (art.profile !== 'art-iphone15') {
    await art.goto('/de')
    const engine = await tabOrder(page)
    await art.goto('/de?leash=off', { waitLeash: false })
    const off = await tabOrder(page)
    art.extra('tabOrder', { engine, off })
  }
})
