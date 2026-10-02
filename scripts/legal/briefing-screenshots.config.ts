import { defineConfig } from '@playwright/test'

import base from '../../playwright.config'

// Playwright-Konfiguration nur für die Bildschirmfotos der Kanzlei-Mappe (PLAN P6.22, KANZLEI-BRIEFING §18 Anlage E):
// gleicher Server, gleiche Test-DB und gleiche Fixtures wie die E2E-Tests (Mock-Treiber), ein Projekt mit 390 × 844,
// Deutsch, Pixeldichte 1 (kleine Dateien). Aufruf über `scripts/legal/briefing-screenshots.ts`.

export default defineConfig({
  ...base,
  testDir: '.',
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
