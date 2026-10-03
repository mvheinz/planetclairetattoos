import { defineConfig, devices, type Project } from '@playwright/test'
import 'dotenv/config'

import {
  ART_DIST_DIR,
  ART_PORT,
  ART_PROFILES,
  ART_VARIANTS,
  type ArtProfile,
} from './scripts/art/lib/run'

// Aufnahme-Konfiguration der Kunst-Abnahme (KUNST-QA §4.1/§4.2, PLAN P9.2; ARCHITEKTUR §7.3): Projekte mit Präfix
// `art-` je Geräteprofil × Bewegungs-Variante (`motion`, `reduced`) plus `art-pixel7-tempo` (SC-18, ohne Video, CPU 4×
// per CDP im Test). Welche Szenarien ein Projekt aufnimmt, steht als Tags am Test (`@art-pixel7 @reduced`, KUNST-QA
// §4.3) – das Projekt wählt per `grep` genau seine Kombination. Server: Produktions-Build aus `pnpm art:build`
// (`.next-art`) mit `ART_QA=1`, nie `pnpm dev` (§4.1). Gestartet über `pnpm art:record` (Lauf-ID, Ablage).

const skipWebkit = process.env.PW_SKIP_WEBKIT === '1'
const port = Number(process.env.ART_PORT || ART_PORT)
const baseURL = process.env.ART_BASE_URL || `http://127.0.0.1:${port}`
const distDir = process.env.ART_DIST_DIR || ART_DIST_DIR

/** Geräteprofile (§4.2): Viewport aus dem Deskriptor, nur Desktop fest 1440×900 @1. */
const PROFILE_USE: Record<ArtProfile, Project['use']> = {
  // Ohne WebKit (PW_SKIP_WEBKIT=1): markierte Chromium-Emulation (KUNST-QA §3.3), im Manifest vermerkt.
  'art-iphone15': skipWebkit
    ? { ...devices['iPhone 15'], browserName: 'chromium', defaultBrowserType: 'chromium' }
    : { ...devices['iPhone 15'] },
  'art-pixel7': { ...devices['Pixel 7'] },
  'art-desktop': {
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  },
}

/** Tests eines Projekts: beide Tags (Profil und Variante) müssen am Test stehen. */
const both = (a: string, b: string) => new RegExp(`^(?=.*@${a}(?![\\w-]))(?=.*@${b}(?![\\w-]))`)

const projects: Project[] = ART_PROFILES.flatMap((profile) =>
  ART_VARIANTS.map((variant) => ({
    name: `${profile}-${variant}`,
    grep: both(profile, variant),
    use: {
      ...PROFILE_USE[profile],
      contextOptions: {
        reducedMotion: variant === 'reduced' ? ('reduce' as const) : ('no-preference' as const),
      },
    },
    metadata: {
      profile,
      variant,
      video: true,
      emulated: profile === 'art-iphone15' && skipWebkit ? 'chromium' : null,
    },
  })),
)
projects.push({
  name: 'art-pixel7-tempo',
  grep: both('art-pixel7', 'tempo'),
  use: { ...PROFILE_USE['art-pixel7'], contextOptions: { reducedMotion: 'no-preference' } },
  metadata: { profile: 'art-pixel7', variant: 'tempo', video: false, emulated: null },
})

export default defineConfig({
  testDir: './tests/art',
  testMatch: '**/*.art.spec.ts',
  outputDir: 'artifacts/art-qa/.playwright',
  globalSetup: './tests/art/helpers/global-setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: Number(process.env.ART_WORKERS || 1),
  timeout: 15 * 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    colorScheme: 'light',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    navigationTimeout: 30_000,
  },
  projects,
  webServer: process.env.ART_NO_SERVER
    ? undefined
    : {
        command: `node -e "require('node:fs').rmSync('${distDir}/cache/fetch-cache',{recursive:true,force:true})" && pnpm start -p ${port} -H 127.0.0.1`,
        url: `${baseURL}/de`,
        reuseExistingServer: true,
        timeout: 240_000,
        env: {
          NODE_OPTIONS: '--no-deprecation',
          NEXT_DIST_DIR: distDir,
          ART_QA: '1',
          PAYLOAD_DB_PUSH: 'false',
          PAYMENTS_DRIVER: 'mock',
        },
      },
})
