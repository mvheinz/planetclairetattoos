import { expect } from '@playwright/test'

import { artTags, test } from './helpers/fixtures'
import { leashStations, readingFrame, releaseReading, stationBounds } from './helpers/leash'

// SC-02 (KUNST-QA §4.3, §5.7): R01 nur `reduced` – laden, bis zum Ende scrollen; Frames an denselben Positionen wie
// SC-01; Zeitvergleich t = 0 gegen t = 2 s (nichts bewegt sich).

test('SC-02 Startseite reduziert', { tag: artTags('all', ['reduced']) }, async ({ art }) => {
  const { page } = art
  await art.goto('/de')
  await art.pauseClock()
  const t0 = await page.screenshot({ type: 'png' })
  await art.frame('top-t0000')
  await page.clock.runFor(2000)
  const t2 = await page.screenshot({ type: 'png' })
  await art.frame('top-t2000')
  const same = t0.equals(t2)
  art.json('time-compare', { t0VsT2000Identical: same })
  expect(same, 'reduzierte Startseite verändert sich zwischen t=0 und t=2 s').toBe(true)
  const stations = await leashStations(page)
  for (const [i, s] of stations.entries())
    for (const b of stationBounds(s))
      await readingFrame(art, b.y, `station${i + 1}-${b.tag}-y${Math.round(b.y)}`)
  await releaseReading(page)
  await art.resumeClock()
  await art.scrollRun(await page.evaluate(() => document.documentElement.scrollHeight), 1500)
  await art.settledFrame('end')
})
