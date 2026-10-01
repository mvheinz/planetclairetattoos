import { defineConfig, devices } from '@playwright/test'

import base, { startCommand } from './playwright.config'

// Visuelle Regression (ARCHITEKTUR §7.6, PLAN P2.24, T-12): Chromium, Projekte `desktop` (1440 × 900) und `mobile`
// (Mobil-Emulation 390 × 844), `reducedMotion: 'reduce'`, Uhr fest, Schriften geladen, `maxDiffPixelRatio: 0.01`.
// Server, Test-DB und Revalidierung wie bei E2E (`playwright.config.ts`, §7.2).
//
// Referenzbilder gibt es nur für Linux (`tests/visual/__screenshots__/**/*-linux.png`) und sollen in CI entstehen
// (`[ci:update-snapshots]` → Artefakt → Commit mit `[skip ci]`, §7.6). Ausnahme P2 (OFFENE-PUNKTE): Das Artefakt ist aus
// der Cloud-Sandbox nicht abrufbar; die Bilder entstanden auf Ubuntu 24.04 mit demselben Chromium gegen den
// Produktions-Build und werden vom CI-Job `quality` gegengeprüft. Auf Windows/macOS werden die Tests übersprungen.
//
// Immer gegen den Produktions-Build ohne Debug-Schalter (§7.6) – nie gegen `pnpm dev` (Dev-Werkzeuge im Bild).
process.env.E2E_SERVER = 'start'

export default defineConfig({
  ...base,
  webServer:
    base.webServer && !Array.isArray(base.webServer)
      ? { ...base.webServer, command: startCommand }
      : base.webServer,
  testDir: './tests/visual',
  testMatch: '**/*.visual.spec.ts',
  testIgnore: [],
  // Nacheinander wie in CI: `checkout-pages.visual.spec.ts` legt verfügbare Fixture-Stücke (980–989) an, die parallel
  // laufende Seiten mit Stück-Listen (R01, R02, R04 „Mehr Stücke“) sonst kurzzeitig mit abbilden würden.
  workers: 1,
  snapshotPathTemplate:
    '{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}-{platform}{ext}',
  expect: {
    ...base.expect,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      // Farbabstand je Pixel (YIQ, 0–1): strenger als der Standard 0,2, damit auch leichte Token-Tönungen auffallen.
      threshold: 0.05,
      animations: 'disabled',
      caret: 'hide',
      // Bilder in CSS-Pixeln (klein im Repo, unabhängig von der Pixeldichte der Emulation).
      scale: 'css',
    },
  },
  use: {
    ...base.use,
    contextOptions: { reducedMotion: 'reduce' },
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      // Mobil-Emulation in Chromium (Touch, Mobil-UA); Viewport laut KONZEPT EK-02/AK-7-04.
      use: {
        ...devices['iPhone 15'],
        browserName: 'chromium',
        defaultBrowserType: 'chromium',
        viewport: { width: 390, height: 844 },
      },
    },
  ],
})
