import { describe, expect, it } from 'vitest'

import { assertProductionEnv, parseEnv, seedPreviewModeActive } from '@/lib/env'
import { isMediaPubliclyVisible, isUnapprovedOwnerPhoto } from '@/lib/tattoo/visibility'

// P8.20 (R-181, KONZEPT §9.7, DATENMODELL §14): Der Vorschau-Modus wirkt nie in Produktion – die Startprüfung bricht mit
// `SEED_PREVIEW_MODE=true` und `APP_ENV=production` ab, in development/test/preview nicht; `seedPreviewModeActive()`
// liefert in Produktion immer `false`. Fotos von Jutta (`showsPerson = jutta`) sind ohne `ownerApproved` nie öffentlich.

const prod: Record<string, string> = {
  APP_ENV: 'production',
  DATABASE_URL: 'postgres://u:p@db.example.test:5432/app',
  PAYLOAD_SECRET: 'a'.repeat(64),
  CRON_SECRET: 'b'.repeat(40),
  NEXT_PUBLIC_SITE_URL: 'https://planetclairetattoos.com',
  ADMIN_ROUTE: '/atelier-x7',
  STORAGE_DRIVER: 's3',
  S3_ENDPOINT: 'https://abc123.eu.r2.cloudflarestorage.com',
  EMAIL_DRIVER: 'smtp',
  PAYMENTS_DRIVER: 'stripe',
  TRANSLATION_DRIVER: 'deepl',
  STRIPE_SECRET_KEY: 'sk_live_TESTVALUEONLY',
  STRIPE_WEBHOOK_SECRET: 'whsec_TESTVALUEONLY',
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_TESTVALUEONLY',
}
const dev = { PAYLOAD_SECRET: 'dev', SEED_PREVIEW_MODE: 'true' }

describe('P8.20 Vorschau-Modus nie in Produktion (R-181)', () => {
  it('R-181: Startprüfung wirft mit SEED_PREVIEW_MODE=true in der Produktionskonstellation – mit klarer Meldung', () => {
    expect(() => assertProductionEnv(parseEnv({ ...prod, SEED_PREVIEW_MODE: 'true' }))).toThrow(
      /SEED_PREVIEW_MODE=true ist in Produktion verboten \(R-181\)/,
    )
    expect(() =>
      assertProductionEnv(parseEnv({ ...prod, SEED_PREVIEW_MODE: 'false' })),
    ).not.toThrow()
  })

  it.each(['development', 'test', 'preview'])(
    'R-181: in %s wirft die Startprüfung mit SEED_PREVIEW_MODE=true nicht, der Modus ist aktiv',
    (appEnv) => {
      const env = parseEnv({ ...dev, APP_ENV: appEnv })
      expect(() => assertProductionEnv(env)).not.toThrow()
      expect(seedPreviewModeActive(env)).toBe(true)
    },
  )

  it('R-181: seedPreviewModeActive() ist in Produktion immer false', () => {
    expect(seedPreviewModeActive(parseEnv({ ...prod, SEED_PREVIEW_MODE: 'true' }))).toBe(false)
    expect(seedPreviewModeActive(parseEnv({ ...prod, SEED_PREVIEW_MODE: 'false' }))).toBe(false)
  })
})

describe('P8.20 Fotos von Jutta nur mit Freigabe (R-181, DM-MEDIA-06)', () => {
  const preview = { APP_ENV: 'preview', SEED_PREVIEW_MODE: true } as const
  const live = { APP_ENV: 'production', SEED_PREVIEW_MODE: false } as const

  it('showsPerson = jutta ohne ownerApproved → nie öffentlich (auch im Vorschau-Modus, auch als Seed)', () => {
    const photo = { showsPerson: 'jutta', restricted: false, ownerApproved: false }
    expect(isUnapprovedOwnerPhoto(photo)).toBe(true)
    expect(isMediaPubliclyVisible(photo, live)).toBe(false)
    expect(isMediaPubliclyVisible(photo, preview)).toBe(false)
    expect(isMediaPubliclyVisible({ ...photo, seed: true }, preview)).toBe(false)
  })

  it('mit ownerApproved → öffentlich wie jedes andere Bild', () => {
    const photo = { showsPerson: 'jutta', restricted: false, ownerApproved: true }
    expect(isUnapprovedOwnerPhoto(photo)).toBe(false)
    expect(isMediaPubliclyVisible(photo, live)).toBe(true)
  })

  it('andere Bilder unverändert (none sichtbar, customer gesperrt)', () => {
    expect(isMediaPubliclyVisible({ showsPerson: 'none', restricted: false }, live)).toBe(true)
    expect(isMediaPubliclyVisible({ showsPerson: 'customer', restricted: true }, live)).toBe(false)
  })
})
