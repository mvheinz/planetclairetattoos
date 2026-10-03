import { QA_MICROS } from '../../src/lib/qa/microInteractions'
import { artTags, test } from './helpers/fixtures'

// SC-14 (KUNST-QA §4.3, §4.4): jede Mikro-Interaktion MI-01 … MI-16 isoliert auf `/de/qa/motion?mi=…` – „Abspielen“,
// dann Sequenz alle 20 ms per Seek (WAAPI/CSS über `getAnimations()`, rAF/Timer über die Playwright-Clock) bis zum Ende
// des Ablaufs. Bühne als Ausschnitt; Menü, Kauf-Leiste und Seitenübergang im ganzen Sichtbereich. MI-16 (`:active`)
// per gedrücktem Zeiger.

test(
  'SC-14 Mikro-Interaktionen isoliert',
  { tag: artTags(['art-desktop', 'art-iphone15']) },
  async ({ art }) => {
    const { page } = art
    for (const mi of QA_MICROS) {
      await art.goto(`/de/qa/motion?mi=${mi.id}`, { waitLeash: false })
      const stage = page.locator(`[data-qa-stage="${mi.id}"]`)
      await page.waitForSelector(`[data-qa-stage="${mi.id}"][data-qa-played="1"]`, {
        timeout: 15_000,
      })
      await page.waitForTimeout(Math.min(6000, mi.durationMs + 300))
      await stage.scrollIntoViewIfNeeded()
      const element = mi.viewport ? undefined : stage
      await art.frame(`${mi.id}-idle`, element ? { element } : {})
      const prefix = mi.id.toLowerCase()
      // MI-08 (Countdown) ist keine Animation (DESIGN §11.5): Sekundentakt statt 20 ms.
      const stepMs = art.step(mi.id === 'MI-08' ? 250 : 20, mi.durationMs)
      await art.sequence({
        stepMs,
        untilMs: mi.durationMs,
        prefix,
        ...(element ? { element } : {}),
        start: async () => {
          if (mi.press) {
            const btn = stage.locator('button').first()
            const box = await btn.boundingBox()
            if (box) {
              await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
              await page.mouse.down()
            }
            return
          }
          await page.evaluate(() => document.querySelector<HTMLElement>('[data-qa-play]')?.click())
          // Uhr steht: bis zum Auslösen (zwei Frames nach dem Binden) in 16-ms-Schritten vorspulen.
          const played = stage.and(page.locator('[data-qa-played="2"]'))
          for (let i = 0; i < 200 && (await played.count()) === 0; i++) await page.clock.runFor(16)
        },
      })
      if (mi.press) await page.mouse.up()
    }
  },
)
