import { expect, test } from '@playwright/test'

import { localizedPath } from '../../src/lib/routes/paths'
import { linuxOnly, loadAllImages, prepare, settle } from './helpers'

// T-12 Shop-Bausteine (PLAN P3.4, DESIGN KO-05/KO-06/KO-07): Preisschild normal und verkauft, Produktkarte verfügbar,
// reserviert und verkauft – auf der Shop-Übersicht (R02, P3.5; Nr. 906 auf R03 Keramik) mit dem Beispielbestand: S01 (Nr. 901, verfügbar),
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

// Mit dem vollen Beispielbestand (P8) steht Nr. 906 nicht mehr auf der ersten Shop-Seite – verkaufte Keramik zeigt die
// Kategorie-Seite Keramik (R03, gleiche Karten-Komponente).
async function openList(page: import('@playwright/test').Page, nr: number) {
  linuxOnly()
  await prepare(page)
  const path =
    nr === 906 ? localizedPath('R03', 'de', { slug: 'keramik' }) : localizedPath('R02', 'de')
  const res = await page.goto(path)
  expect(res?.status()).toBe(200)
  await loadAllImages(page)
  await settle(page)
}

for (const c of CARDS) {
  test(`Produktkarte ${c.name} (Nr. ${c.nr})`, async ({ page }) => {
    await openList(page, c.nr)
    const card = page.locator(`[data-product-card][data-item-number="${c.nr}"]`)
    await card.scrollIntoViewIfNeeded()
    await expect(card).toHaveScreenshot(`${c.name}.png`)
  })
}

for (const t of TAGS) {
  test(`Preisschild ${t.name} (Nr. ${t.nr})`, async ({ page }) => {
    await openList(page, t.nr)
    const tag = page.locator(`[data-product-card][data-item-number="${t.nr}"] [data-price-tag]`)
    await tag.scrollIntoViewIfNeeded()
    await expect(tag).toHaveScreenshot(`${t.name}.png`)
  })
}
