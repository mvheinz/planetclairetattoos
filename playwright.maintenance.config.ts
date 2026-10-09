import { defineConfig, devices } from '@playwright/test'
import 'dotenv/config'

// Wartungsmodus (P10.7, ARCHITEKTUR §10.5): eigener Server mit `MAINTENANCE_MODE=true` auf Port 3201, damit der normale
// E2E-Lauf unverändert bleibt. `pnpm test:e2e:maintenance` (CI: im Job `e2e-full` zusätzlich).
const testDatabaseUrl = process.env.DATABASE_URL_TEST
if (testDatabaseUrl) process.env.DATABASE_URL = testDatabaseUrl
const port = process.env.E2E_MAINTENANCE_PORT || '3201'
const baseURL = `http://localhost:${port}`

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/maintenance.e2e.spec.ts',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: `pnpm dev --port ${port}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      NODE_OPTIONS: '--no-deprecation',
      PAYLOAD_DB_PUSH: 'false',
      APP_ENV: 'test',
      MAINTENANCE_MODE: 'true',
      NEXT_PUBLIC_SITE_URL: baseURL,
      ...(testDatabaseUrl ? { DATABASE_URL: testDatabaseUrl } : {}),
    },
  },
})
