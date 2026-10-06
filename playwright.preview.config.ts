import { defineConfig, devices } from '@playwright/test'

// Abnahmetest der Vorschau-Datei (ARCHITEKTUR §14.10, KONZEPT §12.7): `pnpm test:preview-export` öffnet
// `dist/planet-claire-vorschau.html` per `file://` – ohne Server (`webServer` fehlt absichtlich), offline, und bricht
// jede Anfrage außer `file:`/`data:`/`blob:` ab (Route im Test, dort protokolliert). Chromium in zwei Größen. Der
// Portabilitätstest (P10.20, `preview-portable.e2e.spec.ts`) kopiert nur die Datei in ein frisches Temp-Verzeichnis und
// läuft mit Chromium und WebKit (Safari-Engine; `PW_SKIP_WEBKIT=1` lässt das WebKit-Projekt weg, dann zählt die CI).
// `pnpm test:preview-portable` führt nur diese Projekte aus (auch gegen das heruntergeladene Release-Asset).
// Vorher `pnpm preview:export` ausführen.
const skipWebkit = process.env.PW_SKIP_WEBKIT === '1'
const EXPORT_SPEC = '**/preview-export.e2e.spec.ts'
const PORTABLE_SPEC = '**/preview-portable.e2e.spec.ts'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: [EXPORT_SPEC, PORTABLE_SPEC],
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
      testMatch: [EXPORT_SPEC],
      use: {
        ...devices['Pixel 7'],
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: 'pv-desktop',
      testMatch: [EXPORT_SPEC],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'pv-portable-chromium',
      testMatch: [PORTABLE_SPEC],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    ...(skipWebkit
      ? []
      : [
          {
            name: 'pv-portable-webkit',
            testMatch: [PORTABLE_SPEC],
            use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 800 } },
          },
        ]),
  ],
})
