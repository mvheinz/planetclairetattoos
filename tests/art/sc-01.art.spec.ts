import { maxScroll } from './helpers/capture'
import { artTags, test } from './helpers/fixtures'
import { leashStations, readingFrame, releaseReading, stationBounds } from './helpers/leash'

// SC-01 (KUNST-QA §4.3): Startseite R01 – (a) Intro abwarten (Sequenz alle 100 ms), (b) langsam scrollen 600 px/s bis
// zum Ende, (c) schnell „wischen“ 3000 px/s, (d) 400 px hoch, (e) 1,5 s stehen an jeder Station. Frames an jeder
// Station-Grenze (`y − 40`, `y`, `y + loopScroll/2`, `y + loopScroll`, `+1,5 s`).

test('SC-01 Startseite: Intro, Scrollen, Stationen', { tag: artTags('all') }, async ({ art }) => {
  const { page } = art
  // (a) Intro: Uhr vor dem Laden anhalten, bis die Engine steht vorspulen, dann Sequenz.
  await art.pauseClock()
  await page.goto('/de', { waitUntil: 'load' })
  for (let i = 0; i < 160; i++) {
    if (await page.evaluate(() => !!(window as Window & { __leash?: unknown }).__leash)) break
    await page.clock.runFor(50)
  }
  await art.sequence({ stepMs: art.step(100, 1600), untilMs: 1600, prefix: 'intro' })

  // (b)–(d) Echtzeit für das Video.
  const bottom = await maxScroll(page)
  await art.scrollRun(bottom, 600)
  await art.scrollRun(0, 3000)
  await art.scrollRun(Math.min(bottom, 2400), 3000)
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
  }
  await releaseReading(page)
  await art.resumeClock()
})
