import { describe, expect, it } from 'vitest'

import {
  assertProductionEnv,
  collectEnvViolations,
  hostMatchesPattern,
  parseEnv,
  seedPreviewModeActive,
} from '@/lib/env'

// Gültige Produktionswerte (nur Testwerte, keine echten Schlüssel).
const prod: Record<string, string> = {
  APP_ENV: 'production',
  DATABASE_URL:
    'postgres://u:p@ep-test-000000-pooler.eu-central-1.aws.neon.tech/app?sslmode=require',
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
  SEED_PREVIEW_MODE: 'false',
}

const errorsFor = (patch: Record<string, string>) =>
  collectEnvViolations(parseEnv({ ...prod, ...patch })).errors

describe('T-17 Start-Prüfung in Produktion (ARCHITEKTUR §4.3)', () => {
  it('T-17 gültige Produktionswerte bestehen', () => {
    expect(errorsFor({})).toEqual([])
  })

  it.each([
    ['STORAGE_DRIVER', { STORAGE_DRIVER: 'local' }],
    ['EMAIL_DRIVER', { EMAIL_DRIVER: 'file' }],
    ['PAYMENTS_DRIVER', { PAYMENTS_DRIVER: 'mock' }],
    ['STRIPE_SECRET_KEY', { STRIPE_SECRET_KEY: 'sk_test_x' }],
    ['STRIPE_WEBHOOK_SECRET', { STRIPE_WEBHOOK_SECRET: 'abc' }],
    ['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', { NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_x' }],
    ['PAYLOAD_SECRET', { PAYLOAD_SECRET: 'short' }],
    ['PAYLOAD_SECRET', { PAYLOAD_SECRET: 'change-me-dev-only-0000000000000000' }],
    ['CRON_SECRET', { CRON_SECRET: 'short' }],
    ['ADMIN_ROUTE', { ADMIN_ROUTE: '/admin' }],
    ['ADMIN_ROUTE', { ADMIN_ROUTE: '/werkstatt' }],
    ['ADMIN_ROUTE', { ADMIN_ROUTE: '/abc' }],
    ['ADMIN_ROUTE', { ADMIN_ROUTE: `/${'a'.repeat(45)}` }],
    ['NEXT_PUBLIC_SITE_URL', { NEXT_PUBLIC_SITE_URL: 'https://www.planetclairetattoos.com' }],
    ['S3_ENDPOINT', { S3_ENDPOINT: 'https://abc123.r2.cloudflarestorage.com' }],
    ['SEED_PREVIEW_MODE', { SEED_PREVIEW_MODE: 'true' }],
    // EU-Regionen laut Datenschutzerklärung (Prüfung P18.5): Sentry nur EU-Ingest, Neon nur aws-eu-central-1
    ['SENTRY_DSN', { SENTRY_DSN: 'https://k@o1.ingest.us.sentry.io/2' }],
    ['SENTRY_DSN', { SENTRY_DSN: 'https://k@o1.ingest.sentry.io/2' }],
    ['SENTRY_DSN', { SENTRY_DSN: 'https://k@o1-ingest.de.sentry.io.example.com/2' }],
    ['SENTRY_DSN', { SENTRY_DSN: 'kein-dsn' }],
    ['DATABASE_URL', { DATABASE_URL: 'postgres://u:p@ep-x-pooler.us-east-2.aws.neon.tech/app' }],
    ['DATABASE_URL', { DATABASE_URL: 'postgres://u:p@ep-x.eu-central-1.azure.neon.tech/app' }],
    [
      'DATABASE_URL_UNPOOLED',
      { DATABASE_URL_UNPOOLED: 'postgres://u:p@ep-x.eu-west-2.aws.neon.tech/app' },
    ],
  ])('T-17 Verstoß gegen %s bricht ab', (name, patch) => {
    const errors = errorsFor(patch)
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain(name)
    expect(() => assertProductionEnv(parseEnv({ ...prod, ...patch }))).toThrow(name)
  })

  it('EU-Regionen: Sentry-DSN der EU und Neon aws-eu-central-1 (gepoolt und direkt) bestehen ohne Warnung', () => {
    const r = collectEnvViolations(
      parseEnv({
        ...prod,
        SENTRY_DSN: 'https://abc123@o450000.ingest.de.sentry.io/4500000000000000',
        DATABASE_URL_UNPOOLED: 'postgres://u:p@ep-test-000000.eu-central-1.aws.neon.tech/app',
      }),
    )
    expect(r).toEqual({ errors: [], warnings: [] })
  })

  it('EU-Regionen: eigener Postgres (Docker-Exit-Pfad, ARCHITEKTUR §13) ist erlaubt, aber eine Warnung', () => {
    const r = collectEnvViolations(
      parseEnv({ ...prod, DATABASE_URL: 'postgres://planetclaire:x@postgres:5432/planetclaire' }),
    )
    expect(r.errors).toEqual([])
    expect(r.warnings).toEqual([
      'DATABASE_URL zeigt nicht auf Neon (postgres) – Datenschutzerklärung und DIENSTE.md (Datenbank-Hosting) anpassen.',
    ])
  })

  it('Host-Muster aus DIENSTE §7: `*.` verlangt mindestens ein Label davor', () => {
    expect(hostMatchesPattern('o1.ingest.de.sentry.io', '*.ingest.de.sentry.io')).toBe(true)
    expect(hostMatchesPattern('ingest.de.sentry.io', '*.ingest.de.sentry.io')).toBe(false)
    expect(hostMatchesPattern('evilingest.de.sentry.io', '*.ingest.de.sentry.io')).toBe(false)
    expect(hostMatchesPattern('a..ingest.de.sentry.io', '*.ingest.de.sentry.io')).toBe(false)
    expect(hostMatchesPattern('api.stripe.com', 'api.stripe.com')).toBe(true)
    expect(hostMatchesPattern('x.api.stripe.com', 'api.stripe.com')).toBe(false)
  })

  it('T-17 TRANSLATION_DRIVER ≠ deepl ist nur eine Warnung', () => {
    const r = collectEnvViolations(parseEnv({ ...prod, TRANSLATION_DRIVER: 'mock' }))
    expect(r.errors).toEqual([])
    expect(r.warnings.join()).toContain('TRANSLATION_DRIVER')
  })

  it('AK-A-3-02 mehrere Verstöße erscheinen in einer Meldung', () => {
    const env = parseEnv({
      ...prod,
      STORAGE_DRIVER: 'local',
      ADMIN_ROUTE: '/admin',
      CRON_SECRET: 'x',
    })
    let message = ''
    try {
      assertProductionEnv(env)
    } catch (e) {
      message = (e as Error).message
    }
    expect(message).toContain('STORAGE_DRIVER')
    expect(message).toContain('ADMIN_ROUTE')
    expect(message).toContain('CRON_SECRET')
  })

  it('R-181 SEED_PREVIEW_MODE wirkt in Produktion nie', () => {
    expect(seedPreviewModeActive(parseEnv({ ...prod, SEED_PREVIEW_MODE: 'true' }))).toBe(false)
    expect(
      seedPreviewModeActive(parseEnv({ SEED_PREVIEW_MODE: 'true', PAYLOAD_SECRET: 'x' })),
    ).toBe(true)
  })
})

describe('Start-Prüfung außerhalb von Produktion', () => {
  const dev = { APP_ENV: 'development', PAYLOAD_SECRET: 'dev' }

  it('AK-1-02 sk_live_ bei APP_ENV≠production bricht ab', () => {
    expect(() => assertProductionEnv(parseEnv({ ...dev, STRIPE_SECRET_KEY: 'sk_live_x' }))).toThrow(
      'STRIPE_SECRET_KEY',
    )
    expect(() =>
      assertProductionEnv(parseEnv({ ...dev, APP_ENV: 'test', STRIPE_SECRET_KEY: 'rk_live_x' })),
    ).toThrow()
  })

  it('AK-A-3-01 Standardwerte mit leeren Zugangsdaten sind gültig', () => {
    const env = parseEnv(dev)
    expect(env.APP_ENV).toBe('development')
    expect(env.PAYMENTS_DRIVER).toBe('mock')
    expect(() => assertProductionEnv(env)).not.toThrow()
  })

  it('AK-SEED-16 ungültiges SEED_NOW bricht mit klarer Meldung ab', () => {
    expect(() => parseEnv({ ...dev, SEED_NOW: '2026-10-15 10:00' })).toThrow(/SEED_NOW.*ISO 8601/)
    expect(() => parseEnv({ ...dev, SEED_NOW: '2026-10-15T10:00:00' })).toThrow(/SEED_NOW/)
    expect(parseEnv({ ...dev, SEED_NOW: '2026-10-15T10:00:00+02:00' }).SEED_NOW).toBe(
      '2026-10-15T10:00:00+02:00',
    )
  })

  it('Formatfehler brechen immer ab', () => {
    expect(() => parseEnv({ ...dev, ADMIN_ROUTE: 'werkstatt' })).toThrow('ADMIN_ROUTE')
    expect(() => parseEnv({ ...dev, APP_ENV: 'prod' })).toThrow('APP_ENV')
  })
})
