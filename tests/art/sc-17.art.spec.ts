import { artTags, test } from './helpers/fixtures'
import { leashStations, readingFrame, releaseReading } from './helpers/leash'

// SC-17 (KUNST-QA §4.3, §5.7): R01 auf `art-pixel7` mit `forcedColors: 'active'` – Frames oben und an jeder Station.

test('SC-17 Erzwungene Farben', { tag: artTags(['art-pixel7']) }, async ({ art }) => {
  const { page } = art
  await page.emulateMedia({ forcedColors: 'active' })
  await art.goto('/de')
  await art.settledFrame('forced-colors-top')
  const stations = await leashStations(page)
  for (const s of stations)
    await readingFrame(
      art,
      s.y + s.loopScroll,
      `forced-colors-${s.id}-y${Math.round(s.y + s.loopScroll)}`,
    )
  await releaseReading(page)
})
