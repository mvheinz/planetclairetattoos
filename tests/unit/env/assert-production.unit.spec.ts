import { describe, expect, it } from 'vitest'

import {
  assertProductionEnv,
  collectEnvViolations,
  parseEnv,
  seedPreviewModeActive,
} from '@/lib/env'

// Gültige Produktionswerte (nur Testwerte, keine echten Schlüssel).
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
  ])('T-17 Verstoß gegen %s bricht ab', (name, patch) => {
    const errors = errorsFor(patch)
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain(name)
    expect(() => assertProductionEnv(parseEnv({ ...prod, ...patch }))).toThrow(name)
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
