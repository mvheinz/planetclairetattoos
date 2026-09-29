import { expect, test } from '@playwright/test'

import { localizedPath } from '../../src/lib/routes/paths'
import { linuxOnly, loadAllImages, prepare, settle } from './helpers'

// T-12 Shop-Bausteine (PLAN P3.4, DESIGN KO-05/KO-06/KO-07): Preisschild normal und verkauft, Produktkarte verfügbar,
// reserviert und verkauft – auf der Shop-Übersicht (R02, P3.5) mit dem Mini-Beispielbestand: S01 (Nr. 901, verfügbar),
// S27 (Nr. 927, reserviert), S06 (Nr. 906, verkauft, im Archiv sichtbar). Reduzierte Bewegung (kein Schwingen/Knall).
// Linux-Referenzbilder lokal gegen den Produktions-Build (P3.16, OFFENE-PUNKTE N-02); die CI-Qualitätsprüfung vergleicht.

const CARDS = [
  { name: 'karte-verfuegbar', nr: 901 },
  { name: 'karte-reserviert', nr: 927 },
  { name: 'karte-verkauft', nr: 906 },
] as const

const TAGS = [
  { name: 'schild-normal', nr: 901 },
  { name: 'schild-verkauft', nr: 906 },
] as const

test.beforeEach(async ({ page }) => {
  linuxOnly()
  await prepare(page)
  const res = await page.goto(localizedPath('R02', 'de'))
  expect(res?.status()).toBe(200)
  await loadAllImages(page)
  await settle(page)
})

for (const c of CARDS) {
  test(`Produktkarte ${c.name} (Nr. ${c.nr})`, async ({ page }) => {
    const card = page.locator(`[data-product-card][data-item-number="${c.nr}"]`)
    await card.scrollIntoViewIfNeeded()
    await expect(card).toHaveScreenshot(`${c.name}.png`)
  })
}

for (const t of TAGS) {
  test(`Preisschild ${t.name} (Nr. ${t.nr})`, async ({ page }) => {
    const tag = page.locator(`[data-product-card][data-item-number="${t.nr}"] [data-price-tag]`)
    await tag.scrollIntoViewIfNeeded()
    await expect(tag).toHaveScreenshot(`${t.name}.png`)
  })
}
