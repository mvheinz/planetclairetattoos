import { maxScroll } from './helpers/capture'
import { followSamples, introTiming, readingSeries } from './helpers/extras'
import { artTags, test } from './helpers/fixtures'
import { leashStations, readingFrame, releaseReading, stationBounds } from './helpers/leash'

// SC-01 (KUNST-QA §4.3): Startseite R01 – (a) Intro abwarten (Sequenz alle 100 ms), (b) langsam scrollen 600 px/s bis
// zum Ende, (c) schnell „wischen“ 3000 px/s, (d) 400 px hoch, (e) 1,5 s stehen an jeder Station. Frames an jeder
// Station-Grenze (`y − 40`, `y`, `y + loopScroll/2`, `y + loopScroll`, `+1,5 s`). Für `art:check` (P9.6) zusätzlich:
// Intro-Zeitpunkt und -Dauer (MO-10), Coco-Folgen beim Wischen (MO-07), 400 px zurück (MO-06).

test('SC-01 Startseite: Intro, Scrollen, Stationen', { tag: artTags('all') }, async ({ art }) => {
  const { page } = art
  // (a) Intro: Uhr vor dem Laden anhalten, bis die Engine steht vorspulen, dann Sequenz.
  await art.pauseClock()
  await page.goto('/de', { waitUntil: 'load' })
  // Frames beschriftet mit der Zeit seit der Navigation (R2-01-01: Intro-Start ≥ LCP + 300 ms ist so ablesbar);
  // vor dem Laden der Engine ein Bild „Seite geladen, Linie noch leer“.
  await art.settledFrame('intro-t0000-geladen')
  let waited = 0
  for (let i = 0; i < 160; i++) {
    if (await page.evaluate(() => !!(window as Window & { __leash?: unknown }).__leash)) break
    await page.clock.runFor(25)
    waited += 25
  }
  await art.sequence({
    stepMs: art.step(50, 1200),
    untilMs: 1200,
    prefix: 'intro',
    offsetMs: waited,
  })

  // (b)–(d) Echtzeit für das Video.
  const bottom = await maxScroll(page)
  await art.scrollRun(bottom, 600)
  await art.scrollRun(0, 3000)
  if (art.reduced) await art.scrollRun(Math.min(bottom, 2400), 3000)
  else art.extra('mo07', await followSamples(page, Math.min(bottom, 2400)))
  await art.scrollRun(Math.max(0, Math.min(bottom, 2400) - 400), 800)

  // (e) Station-Grenzen und Verweilen (Uhr angehalten, Lesezeile exakt).
  const stations = await leashStations(page)
  art.json('stations', stations)
  await art.pauseClock()
  for (const [i, s] of stations.entries()) {
    for (const b of stationBounds(s))
      await readingFrame(art, b.y, `station${i + 1}-${b.tag}-y${Math.round(b.y)}`)
    await page.clock.runFor(1500)
    await art.settledFrame(`station${i + 1}-stay1500-y${Math.round(s.y + s.loopScroll)}`)
    // Lupe auf Coco an der Leinenspitze (R2-01-02): Pose und Blickrichtung im Bogen lesbar, 4× vergrößert.
    const box = await page.locator('.coco[data-leash-coco]').boundingBox()
    const vh = page.viewportSize()!.height
    if (box && !art.reduced && box.y >= 0 && box.y + box.height <= vh) {
      const pad = 16
      const vw = page.viewportSize()!.width
      const x = Math.max(0, box.x - pad)
      const y = Math.max(0, box.y - pad)
      const width = Math.min(vw - x, box.width + 2 * pad)
      const height = box.height + 2 * pad
      await art.frame(`station${i + 1}-coco-lupe-y${Math.round(s.y + s.loopScroll)}`, {
        zoom: { x, y, width, height, to: Math.round(width * 4) },
      })
    }
  }
  // (d) MO-06: 400 px zurück – Tinte bleibt.
  const mid = stations[Math.floor(stations.length / 2)]
  if (mid) {
    const y = mid.y + mid.loopScroll
    await readingFrame(art, y, `up400-before-y${Math.round(y)}`)
    await readingFrame(art, y - 400, `up400-after-y${Math.round(y - 400)}`)
  }
  await releaseReading(page)
  await art.resumeClock()

  // MO-05/MO-06: Lesezeilen-Treue auf frischer Seite (12 Positionen), dann 400 px zurück.
  if (!art.reduced) await readingSeries(art)

  // MO-10: Intro-Zeitpunkt (≥ LCP + 300 ms) und Dauer (900 ms ± 90), fein in 20-ms-Schritten (ohne Video-Bilder).
  if (!art.reduced && art.profile !== 'art-iphone15') art.extra('mo10', await introTiming(art))
})
