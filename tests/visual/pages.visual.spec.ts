import { expect, test } from '@playwright/test'

import { localizedPath } from '../../src/lib/routes/paths'
import { dynamicMasks, linuxOnly, loadAllImages, prepare, settle } from './helpers'

// T-12 Seiten (ARCHITEKTUR §7.6, PLAN P2.24): P2-Umfang R01, Impressum (R21), Vertrag widerrufen (R26), 404 (R28) und
// 500 (R29) – je Seitentyp ein ganzseitiges Bild pro Projekt, DE, reduzierte Bewegung. Referenzen R01 (Stationen mit
// Karten, P3.12) und 404 (Nummernfeld, P3.7) in P3.16 erneuert; Shop-Seiten: `shop-pages.visual.spec.ts`.

const PAGES = [
  { name: 'r01-start', path: localizedPath('R01', 'de'), status: 200 },
  { name: 'r21-impressum', path: localizedPath('R21', 'de'), status: 200 },
  { name: 'r26-vertrag-widerrufen', path: localizedPath('R26', 'de'), status: 200 },
  { name: 'r28-404', path: '/de/gibt-es-nicht', status: 404 },
  // Fehler-Auslöser nur bei APP_ENV=test (P2.19; Playwright-Server setzt es).
  { name: 'r29-500', path: '/de/__fehler-test', status: 500 },
] as const

test.beforeEach(async ({ page }) => {
  linuxOnly()
  await prepare(page)
})

for (const p of PAGES) {
  test(`${p.name} (${p.path})`, async ({ page }) => {
    const res = await page.goto(p.path)
    expect(res?.status()).toBe(p.status)
    // Seit P3.12 zeigt die Startseite Karten mit Fotos (lazy) – für die ganzseitige Aufnahme alle laden.
    await loadAllImages(page)
    await settle(page)
    await expect(page).toHaveScreenshot(`${p.name}.png`, {
      fullPage: true,
      mask: dynamicMasks(page),
    })
  })
}
