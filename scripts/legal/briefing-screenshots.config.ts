import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from '@playwright/test'

import base from '../../playwright.config'

// Relative Pfade der Basis-Konfiguration beziehen sich auf deren Ordner (Repo-Wurzel), nicht auf `scripts/legal/`.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const webServer = Array.isArray(base.webServer) ? base.webServer[0] : base.webServer

// Playwright-Konfiguration nur für die Bildschirmfotos der Kanzlei-Mappe (PLAN P6.22, KANZLEI-BRIEFING §18 Anlage E):
// gleicher Server, gleiche Test-DB und gleiche Fixtures wie die E2E-Tests (Mock-Treiber), ein Projekt mit 390 × 844,
// Deutsch, Pixeldichte 1 (kleine Dateien). Aufruf über `scripts/legal/briefing-screenshots.ts`.

export default defineConfig({
  ...base,
  testDir: '.',
  globalSetup: path.join(ROOT, 'tests/e2e/global-setup.ts'),
  outputDir: path.join(ROOT, 'test-results/briefing'),
  ...(webServer ? { webServer: { ...webServer, cwd: ROOT } } : {}),
  testMatch: 'briefing-screenshots.shots.ts',
  testIgnore: [],
  retries: 0,
  workers: 1,
  reporter: [['list']],
  projects: [
    {
      name: 'briefing',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
        locale: 'de-DE',
        timezoneId: 'Europe/Berlin',
        contextOptions: { reducedMotion: 'reduce' },
      },
    },
  ],
})
