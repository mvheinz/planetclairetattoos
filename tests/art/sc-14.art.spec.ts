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
    // `ART_MI=MI-04,MI-11` nimmt nur diese auf (Probelauf nach einer Änderung); ohne Angabe alle 16.
    const only = process.env.ART_MI?.split(',')
    for (const mi of QA_MICROS.filter((m) => !only || only.includes(m.id))) {
      await art.goto(`/de/qa/motion?mi=${mi.id}`, { waitLeash: false })
      const stage = page.locator(`[data-qa-stage="${mi.id}"]`)
      await page.waitForSelector(`[data-qa-stage="${mi.id}"][data-qa-played="1"]`, {
        timeout: 15_000,
      })
      await page.waitForTimeout(Math.min(6000, mi.durationMs + 300))
      // MI-10 (Intro) läuft nur ganz oben (DESIGN §11.5, `scrollY < 8`) – Bühne nicht scrollen (R2-01-01).
      if (mi.id === 'MI-10') await page.evaluate(() => scrollTo(0, 0))
      else await stage.scrollIntoViewIfNeeded()
      // MI-01: Coco `--coco-s` (40 px) hüpft 14 px – Lupe um Coco im Kaufbereich (40 px Rand, oben Platz für den
      // Absprung), 4× vergrößert, damit Absprung, Scheitel und Landung im Bogen lesbar sind (R2-01-03, R2-02-05).
      let zoom: { x: number; y: number; width: number; height: number; to: number } | undefined
      if (mi.id === 'MI-01') {
        const box = await stage.locator('[data-buy-area] .coco').first().boundingBox()
        if (box) {
          const x = Math.max(0, box.x - 40)
          const y = Math.max(0, box.y - 40)
          const width = box.width + 80
          zoom = { x, y, width, height: box.height + 60, to: Math.round(width * 4) }
        }
      }
      // MI-02 (Pendelwinkel der drei Schilder), MI-03 (Überschwinger 1,8 → 0,94 → 1 des Stempels) und MI-09 (Herz am
      // Linienende neben Coco): 3×–4×-Lupe statt Bühne (R2-04-03, R2-04-06).
      const lupeOf: Record<string, { sel: string; pad: number; k: number }> = {
        'MI-02': { sel: '[data-price-tag]', pad: 28, k: 3 },
        'MI-03': { sel: '[data-price-tag]', pad: 28, k: 4 },
        'MI-09': { sel: '[data-thanks-coco-spot]', pad: 90, k: 2 },
      }
      const lupe = lupeOf[mi.id]
      if (lupe) {
        const boxes = await stage.locator(lupe.sel).evaluateAll((els) =>
          els.map((e) => {
            const r = e.getBoundingClientRect()
            return { x: r.left, y: r.top, r: r.right, b: r.bottom }
          }),
        )
        if (boxes.length) {
          const vw = page.viewportSize()!.width
          const x = Math.max(0, Math.min(...boxes.map((b) => b.x)) - lupe.pad)
          const y = Math.max(0, Math.min(...boxes.map((b) => b.y)) - lupe.pad)
          const width = Math.min(vw - x, Math.max(...boxes.map((b) => b.r)) + lupe.pad - x)
          const height = Math.max(...boxes.map((b) => b.b)) + lupe.pad - y
          zoom = { x, y, width, height, to: Math.round(width * lupe.k) }
        }
      }
      const element = mi.viewport || zoom ? undefined : stage
      await art.frame(
        `${mi.id}${zoom ? '-lupe' : ''}-idle`,
        zoom ? { zoom } : element ? { element } : {},
      )
      // Lupen-Aufnahmen tragen „lupe“ im Namen (R2-05-04: sonst nicht als Lupe auffindbar)
      const prefix = mi.id.toLowerCase() + (zoom ? '-lupe' : '')
      // MI-08 (Countdown) ist keine Animation (DESIGN §11.5): Sekundentakt statt 20 ms.
      const stepMs = art.step(mi.id === 'MI-08' ? 250 : 20, mi.durationMs)
      const start = async () => {
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
        // MI-04: Die Pseudo-Elemente der View Transition entstehen erst nach echten Render-Schritten (nicht per Playwright-
        // Uhr). In Echtzeit auf sie warten und sofort auf 0 anhalten, damit der Seek die Wanderung Bild für Bild zeigt
        // (R2-04-02: vorher fehlten die Animationen beim ersten Seek, Coco stand schon am Ziel).
        if (mi.id === 'MI-04') {
          const vt = () =>
            page.evaluate(
              () =>
                document
                  .getAnimations()
                  .filter((a) =>
                    String((a.effect as KeyframeEffect | null)?.pseudoElement ?? '').includes(
                      'view-transition',
                    ),
                  ).length,
            )
          for (let i = 0; i < 100 && (await vt()) === 0; i++)
            await new Promise((r) => setTimeout(r, 30))
          await page.evaluate(() =>
            document.getAnimations().forEach((a) => {
              a.pause()
              a.currentTime = 0
            }),
          )
        }
      }
      await art.sequence({
        stepMs,
        untilMs: mi.durationMs,
        prefix,
        ...(element ? { element } : {}),
        ...(zoom ? { zoom } : {}),
        start,
      })
      // MI-11 (R2-04-01): Coco ist am Horizont nur 24 px groß – zweite Sequenz als 3×-Lupe auf den Horizont (100-ms-Takt),
      // darin Lauf von der Mitte nach rechts und Schwingen der Schlingen im Ausschnitt lesbar.
      if (mi.id === 'MI-11' && !art.reduced) {
        const hz = await page.locator('[data-lost-coco]').locator('xpath=..').boundingBox()
        if (hz) {
          const vw = page.viewportSize()!.width
          const x = Math.max(0, hz.x - 24)
          const width = Math.min(vw - x, hz.width + 48)
          const y = Math.max(0, hz.y - 24)
          const lupe = { x, y, width, height: hz.height + 48, to: Math.round(width * 3) }
          await art.sequence({
            stepMs: 100,
            untilMs: mi.durationMs,
            prefix: `${prefix}-horizont-lupe`,
            zoom: lupe,
            start,
          })
        }
      }
      if (mi.press) await page.mouse.up()
    }
  },
)
