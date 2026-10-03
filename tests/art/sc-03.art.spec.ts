import { artTags, test } from './helpers/fixtures'

// SC-03 (KUNST-QA §4.3): Menü auf R02 – öffnen (Sequenz alle 40 ms bis 800 ms), 1 s stehen, Link per Tab fokussieren
// (Unterstreichung alle 40 ms), mit Esc schließen.

test('SC-03 Menü öffnen, fokussieren, schließen', { tag: artTags('all') }, async ({ art }) => {
  const { page } = art
  await art.goto('/de/shop')
  await page.waitForFunction(
    () => document.documentElement.hasAttribute('data-behaviors-ready'),
    undefined,
    {
      timeout: 15_000,
    },
  )
  await art.settledFrame('closed')
  await art.sequence({
    stepMs: art.step(40, 800),
    untilMs: 800,
    prefix: 'open',
    start: () =>
      page.evaluate(() => document.querySelector<HTMLElement>('[data-menu-trigger]')?.click()),
  })
  await page.waitForTimeout(1000)
  await art.sequence({
    stepMs: art.step(40, 320),
    untilMs: 320,
    prefix: 'focus',
    start: async () => {
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')
    },
  })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  await art.settledFrame('closed-again')
})
