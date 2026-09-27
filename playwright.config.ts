import { defineConfig, devices } from '@playwright/test'
import 'dotenv/config'

// Playwright-Projekte laut ARCHITEKTUR §7.3. E2E läuft gegen die Test-Datenbank (§7.2: `pnpm test:e2e` setzt sie
// vorher zurück) – Server und Test-Helfer nutzen dieselbe DATABASE_URL.
const testDatabaseUrl = process.env.DATABASE_URL_TEST
if (testDatabaseUrl) process.env.DATABASE_URL = testDatabaseUrl

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000'
const serverCommand = process.env.E2E_SERVER === 'start' ? 'pnpm start' : 'pnpm dev'
const skipWebkit = process.env.PW_SKIP_WEBKIT === '1'
// `pnpm dev` übersetzt jede Seite beim ersten Aufruf – großzügigere Zeitgrenzen als gegen den Produktions-Build.
const devServer = serverCommand === 'pnpm dev'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.e2e.spec.ts',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: devServer ? 120_000 : 30_000,
  expect: { timeout: devServer ? 20_000 : 5_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    navigationTimeout: devServer ? 60_000 : 15_000,
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'iphone-15',
      // Ohne WebKit (PW_SKIP_WEBKIT=1) als Chromium-Emulation (§7.3).
      use: skipWebkit
        ? { ...devices['iPhone 15'], browserName: 'chromium', defaultBrowserType: 'chromium' }
        : { ...devices['iPhone 15'] },
      metadata: skipWebkit ? { emulated: 'chromium' } : {},
    },
    {
      name: 'pixel-7',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: serverCommand,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      NODE_OPTIONS: '--no-deprecation',
      PAYLOAD_DB_PUSH: 'false',
      ...(testDatabaseUrl ? { DATABASE_URL: testDatabaseUrl } : {}),
    },
  },
})
