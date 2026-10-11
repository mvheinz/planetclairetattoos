import { maxScroll } from './helpers/capture'
import { followSamples, introTiming, readingSeries } from './helpers/extras'
import { artTags, test } from './helpers/fixtures'
import {
  leashStations,
  readingFrame,
  readingStep,
  releaseReading,
  stationBounds,
} from './helpers/leash'

// SC-01 (KUNST-QA §4.3): Startseite R01 – (a) Intro abwarten (Sequenz alle 100 ms), (b) langsam scrollen 600 px/s bis
// zum Ende, (c) schnell „wischen“ 3000 px/s, (d) 400 px hoch, (e) 1,5 s stehen an jeder Station. Frames an jeder
// Station-Grenze (`y − 40`, `y`, `y + loopScroll/2`, `y + loopScroll`, `+1,5 s`). Für `art:check` (P9.6) zusätzlich:
// Intro-Zeitpunkt und -Dauer (MO-10), Coco-Folgen beim Wischen (MO-07), 400 px zurück (MO-06).

test('SC-01 Startseite: Intro, Scrollen, Stationen', { tag: artTags('all') }, async ({ art }) => {
  const { page } = art
  // (a) Intro: Uhr vor dem Laden anhalten, bis die Engine steht vorspulen, dann Sequenz.
  await art.pauseClock()
  await page.goto('/de', { waitUntil: 'load' })
  // Frames beschriftet mit der VIRTUELLEN Zeit (`intro-virtuell-tNNNN`: angehaltene Uhr, vorgespult bis die Engine steht – die echte
  // Ladezeit bis LCP und Engine-Start steckt nicht darin). Der Beleg für Start ≥ LCP + 300 ms und Dauer ≈ 900 ms ist die Messung
  // im Echtzeit-Kontext (`mo10`, `introTiming`), nicht die Frame-Beschriftung (R2-06-02). Vorher ein Bild „Seite geladen, Linie noch leer“.
  // (nur in Bewegung: bei reduzierter Bewegung steht die Linie mit dem Einhängen der Engine, ein Bild davor belegt nichts)
  if (!art.reduced) await art.settledFrame('intro-t0000-geladen')
  let waited = 0
  for (let i = 0; i < 160; i++) {
    if (await page.evaluate(() => !!(window as Window & { __leash?: unknown }).__leash)) break
    await page.clock.runFor(25)
    waited += 25
  }
  await art.sequence({
    stepMs: art.step(50, 1200),
    untilMs: 1200,
    prefix: 'intro-virtuell',
    offsetMs: waited,
  })

  // Ruhe nach dem Intro (R2-08-07): Uhr weiter, ohne zu scrollen – Coco bremst und sitzt (Beleg „sitzt nach dem Laden“).
  if (!art.reduced) {
    await art.pauseClock()
    await page.clock.runFor(1500)
    await art.settledFrame('intro-ruhe-t1500')
    await page.clock.runFor(1500)
    await art.settledFrame('intro-ruhe-t3000')
    await art.resumeClock()
  }

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
      await readingFrame(art, b.y, `station${i}-${s.id}-${b.tag}-y${Math.round(b.y)}`)
    await page.clock.runFor(1500)
    await art.settledFrame(`station${i}-${s.id}-stay1500-y${Math.round(s.y + s.loopScroll)}`)
    // R2-03-03: Verweil-Pose belegen – Kopfschief kommt erst 1,2 s (Kopf-Station) bzw. 1,5 s (textil) nach der Ankunft und
    // die Ankunft selbst dauert (Bremsen), darum zusätzlich ein Bild nach weiteren 1,5 s (Kopfschief hält 3 s).
    await page.clock.runFor(1500)
    await art.settledFrame(`station${i}-${s.id}-stay3000-y${Math.round(s.y + s.loopScroll)}`)
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
      await art.frame(`station${i}-${s.id}-coco-lupe-y${Math.round(s.y + s.loopScroll)}`, {
        zoom: { x, y, width, height, to: Math.round(width * 4) },
      })
    }
  }
  // Station 8 „Ende“ (DESIGN §11.4: oberhalb des Fußbereichs, `sitzen`, Blick zum Betrachter): Seitenende ansteuern, Verweilen,
  // Lupe auf Coco (R2-07-03: bisher gab es nur die Stationen 0–7).
  await readingFrame(art, 1e6, 'station8-ende-arrive-y1000000')
  await page.clock.runFor(1500)
  await art.settledFrame('station8-ende-stay1500-y1000000')
  await page.clock.runFor(1500)
  await art.settledFrame('station8-ende-stay3000-y1000000')
  {
    // Handy: Coco liegt am Linienende unter dem Bildrand – ins Bild holen (R2-08-08)
    await page.locator('.coco[data-leash-coco]').scrollIntoViewIfNeeded()
    const box = await page.locator('.coco[data-leash-coco]').boundingBox()
    const vh = page.viewportSize()!.height
    if (box && !art.reduced && box.y >= 0 && box.y + box.height <= vh) {
      const pad = 16
      const vw = page.viewportSize()!.width
      const x = Math.max(0, box.x - pad)
      const y = Math.max(0, box.y - pad)
      const width = Math.min(vw - x, box.width + 2 * pad)
      await art.frame('station8-ende-coco-lupe-y1000000', {
        zoom: { x, y, width, height: box.height + 2 * pad, to: Math.round(width * 4) },
      })
    }
  }
  // (d) MO-06: 400 px zurück – die Leine wickelt sich mit Coco auf (U-74).
  const mid = stations[Math.floor(stations.length / 2)]
  if (mid) {
    const y = mid.y + mid.loopScroll
    await readingFrame(art, y, `up400-before-y${Math.round(y)}`)
    // R2-04-04: Zwischenbilder des gespiegelten Rücklaufs – 8 Schritte à 50 px, je 90 ms Uhr (Coco läuft in rAF-Schritten
    // der Lesezeile nach, die Leine wickelt sich mit ihr auf – U-74), Sichtbereich und 4×-Lupe auf Coco. Reduziert: Coco bleibt
    // am Ruheplatz.
    if (!art.reduced)
      for (let k = 1; k <= 8; k++)
        await readingStep(art, y - k * 50, `up400-s${k}-y${Math.round(y - k * 50)}`, 90)
    await readingFrame(art, y - 400, `up400-after-y${Math.round(y - 400)}`)
  }
  await releaseReading(page)
  await art.resumeClock()

  // MO-05/MO-06: Lesezeilen-Treue auf frischer Seite (12 Positionen), dann 400 px zurück.
  if (!art.reduced) await readingSeries(art)

  // P12.6/P13.2 (U-08, U-41): Koko (Pupillen alle 1,5 s über einen Hin-und-Zurück-Lauf von 9 s). Nur in Bewegung; bei
  // reduzierter Bewegung ein Standbild (nichts bewegt sich). Der Fitness-Coco der früheren Hallo-Station entfiel mit U-40.
  {
    const koko = page.locator('[data-chairwoman]').first()
    await page.evaluate(() => scrollTo(0, 0))
    if (await koko.count()) {
      await koko.scrollIntoViewIfNeeded()
      if (art.reduced) await art.settledFrame('koko-still')
      else {
        await art.pauseClock()
        for (let t = 0; t <= 9000; t += 1500) {
          await art.settledFrame(`koko-t${String(t).padStart(5, '0')}`)
          await page.clock.runFor(1500)
        }
        await art.resumeClock()
      }
    }
  }

  // MO-10: Intro-Zeitpunkt (≥ LCP + 300 ms) und Dauer (900 ms ± 90), fein in 20-ms-Schritten (ohne Video-Bilder).
  if (!art.reduced) art.extra('mo10', await introTiming(art))
})
