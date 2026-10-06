import { seekBoil } from './helpers/capture'
import { artTags, test } from './helpers/fixtures'

// SC-12 (KUNST-QA §4.3): `/de/qa/coco` – Standbilder je Symbol (Zeile) in allen 7 Größen, je Frame A/B/C einzeln und
// als `?parts=1`-Fassung; Boil-Sequenz bei 0/1/2 Frame-Längen. `art-desktop` vollständig, `art-iphone15` als
// Stichprobe (Frame A und Boil).

test('SC-12 Coco-Symbole', { tag: artTags(['art-desktop', 'art-iphone15']) }, async ({ art }) => {
  const sample = art.profile === 'art-iphone15'
  const rows = art.page.locator('tr[data-qa-row]')
  for (const frame of sample ? ['a'] : ['a', 'b', 'c']) {
    await art.goto(`/de/qa/coco?frame=${frame}`, { waitLeash: false })
    const count = await rows.count()
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i)
      const key = await row.getAttribute('data-qa-row')
      await art.frame(`${key}-${frame}`, { element: row })
    }
  }
  if (!sample) {
    await art.goto('/de/qa/coco?parts=1', { waitLeash: false })
    const count = await rows.count()
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i)
      await art.frame(`${await row.getAttribute('data-qa-row')}-parts`, { element: row })
    }
  }
  // Boil (Standard-Seite, Boil an): alle Boil-Animationen auf 0, 1, 2 Frame-Längen.
  await art.goto('/de/qa/coco', { waitLeash: false })
  const table = art.page.locator('table[data-qa-coco]')
  for (const k of [0, 1, 2]) {
    await seekBoil(art.page, k)
    await art.frame(`boil-k${k}`, { element: table })
  }
})
