import { expect, test, type Page } from '@playwright/test'

import { localizedPath } from '../../src/lib/routes/paths'
import { dynamicMasks, linuxOnly, loadAllImages, prepare, settle } from './helpers'

// T-12 Seitentypen aus P6 (ARCHITEKTUR §7.6, PLAN P6 Phasen-Abnahme): Rechtsseite mit Platzhalter-Band (AGB, R23),
// Kontakt (R20) und die Widerrufsfunktion R26 in Schritt 2 (Zusammenfassung) und Bestätigung. Schritt 1 ist
// `r26-vertrag-widerrufen` in pages.visual.spec.ts. DE, reduzierte Bewegung, ganzseitig.

const STATIC_PAGES = [
  { name: 'r20-kontakt', path: localizedPath('R20', 'de') },
  { name: 'r23-agb', path: localizedPath('R23', 'de') },
] as const

test.beforeEach(async ({ page }) => {
  linuxOnly()
  await prepare(page)
})

async function shoot(page: Page, name: string, extraMasks: string[] = []) {
  await loadAllImages(page)
  await settle(page)
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: true,
    mask: [...dynamicMasks(page), ...extraMasks.map((s) => page.locator(s))],
  })
}

for (const p of STATIC_PAGES) {
  test(`${p.name} (${p.path})`, async ({ page }) => {
    const res = await page.goto(p.path)
    expect(res?.status()).toBe(200)
    await shoot(page, p.name)
  })
}

test('r26 Schritt 2 und Bestätigung', async ({ page }, testInfo) => {
  const res = await page.goto(localizedPath('R26', 'de'))
  expect(res?.status()).toBe(200)
  // Unbekannte Bestellnummer: kein Auswahlschritt, die Zusammenfassung zeigt nur die Angaben (KONZEPT §3.16).
  await page.locator('[name="name"]').fill('Erika Beispiel')
  await page.locator('[name="contractIdentification"]').fill('PC-2026-99999, Schale Langohr')
  await page.locator('[name="email"]').fill(`visual-widerruf-${testInfo.project.name}@example.com`)
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await expect(page.locator('[data-withdraw-step="confirm"]')).toBeVisible()
  // E-Mail je Projekt verschieden → maskiert.
  await shoot(page, 'r26-schritt-2', ['[data-withdraw-summary] dd:nth-of-type(3)'])

  await page.getByRole('button', { name: 'Widerruf bestätigen', exact: true }).click()
  await expect(page.locator('[data-withdraw-step="done"]')).toBeVisible()
  // Kennung und Eingangszeit kommen vom Server (Folgenummer, Wanduhr).
  await shoot(page, 'r26-bestaetigung', [
    '[data-withdraw-reference]',
    '[data-withdraw-received-at]',
    '[data-withdraw-receipt] dd:nth-of-type(5)',
  ])
})
