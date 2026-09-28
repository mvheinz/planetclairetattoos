import { defineConfig, devices } from '@playwright/test'

// Abnahmetest der Vorschau-Datei (ARCHITEKTUR §14.10, KONZEPT §12.7): `pnpm test:preview-export` öffnet
// `dist/planet-claire-vorschau.html` per `file://` – ohne Server (`webServer` fehlt absichtlich), offline, und bricht
// jede Anfrage außer `file:`/`data:`/`blob:` ab (Route im Test, dort protokolliert). Chromium in zwei Größen; der
// Portabilitätstest mit WebKit kommt in P10 (P10.20). Vorher `pnpm preview:export` ausführen.
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['**/preview-export.e2e.spec.ts'],
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : 2,
  timeout: 180_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    offline: true,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'pv-mobile',
      use: {
        ...devices['Pixel 7'],
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: 'pv-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
})
