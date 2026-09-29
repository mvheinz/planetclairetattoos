import { describe, expect, it } from 'vitest'

import { assertProductionEnv, collectEnvViolations, parseEnv } from '@/lib/env'
import { ConfigError } from '@/lib/errors'
import { createPaymentsAdapter } from '@/lib/payments'
import { MOCK_TEST_API_ENVS } from '@/lib/payments/mock'

// P4.4 – Treiber- und Schlüsselregeln der Zahlung (ARCHITEKTUR §3.5, §4.3; T-17): je Regel ein Test. Nur Testwerte.

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
const NON_PROD = ['development', 'test', 'preview', 'staging'] as const

const errors = (vars: Record<string, string>) => collectEnvViolations(parseEnv(vars)).errors
const nonProd = (appEnv: string, over: Record<string, string>) =>
  errors({ APP_ENV: appEnv, PAYLOAD_SECRET: 'dev', ...over })

describe('T-17 Zahlung: Treiberregeln', () => {
  it('AK-A-3-02 T-17 PAYMENTS_DRIVER=mock in Produktion → Abbruch (Start-Prüfung und Adapter)', () => {
    expect(errors({ ...prod, PAYMENTS_DRIVER: 'mock' })).toEqual([
      'PAYMENTS_DRIVER muss in Produktion stripe sein.',
    ])
    expect(() => assertProductionEnv(parseEnv({ ...prod, PAYMENTS_DRIVER: 'mock' }))).toThrow(
      'PAYMENTS_DRIVER',
    )
    expect(() => createPaymentsAdapter(parseEnv({ ...prod, PAYMENTS_DRIVER: 'mock' }))).toThrow(
      ConfigError,
    )
  })

  it('T-17 PAYMENTS_DRIVER=mock ist außerhalb von Produktion erlaubt', () => {
    for (const appEnv of NON_PROD) expect(nonProd(appEnv, { PAYMENTS_DRIVER: 'mock' })).toEqual([])
  })

  it('T-17 Test-API des Mocks nur bei development und test', () => {
    expect([...MOCK_TEST_API_ENVS].sort()).toEqual(['development', 'test'])
  })
})

describe('T-17 Zahlung: Schlüsselregeln', () => {
  it.each(NON_PROD)('AK-1-02 T-17 sk_live_ bei APP_ENV=%s → Abbruch', (appEnv) => {
    expect(nonProd(appEnv, { STRIPE_SECRET_KEY: 'sk_live_x' }).join()).toContain(
      'STRIPE_SECRET_KEY: Live-Schlüssel',
    )
    expect(() =>
      assertProductionEnv(
        parseEnv({ APP_ENV: appEnv, PAYLOAD_SECRET: 'dev', STRIPE_SECRET_KEY: 'sk_live_x' }),
      ),
    ).toThrow('STRIPE_SECRET_KEY')
  })

  it.each(NON_PROD)('AK-1-02 T-17 rk_live_ bei APP_ENV=%s → Abbruch', (appEnv) => {
    expect(nonProd(appEnv, { STRIPE_SECRET_KEY: 'rk_live_x' }).join()).toContain(
      'Live-Schlüssel außerhalb von Produktion',
    )
  })

  it.each(NON_PROD)('AK-1-02 T-17 pk_live_ bei APP_ENV=%s → Abbruch', (appEnv) => {
    expect(nonProd(appEnv, { NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_x' }).join()).toContain(
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    )
  })

  it('T-17 außerhalb von Produktion nur sk_test_/rk_test_ (auch Platzhalter sk_test_proxy) und pk_test_', () => {
    for (const key of ['sk_test_proxy', 'sk_test_123', 'rk_test_abc', '']) {
      expect(nonProd('test', { STRIPE_SECRET_KEY: key }), key).toEqual([])
    }
    for (const key of ['abc', 'pk_test_x', 'whsec_x']) {
      expect(nonProd('test', { STRIPE_SECRET_KEY: key }).join(), key).toContain(
        'sk_test_ oder rk_test_',
      )
    }
    expect(nonProd('development', { NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_x' })).toEqual([])
    expect(
      nonProd('development', { NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'sk_test_x' }).join(),
    ).toContain('pk_test_')
  })

  it('AK-A-3-02 T-17 in Produktion nur Live-Schlüssel: sk_live_/rk_live_ ja, sk_test_/rk_test_ nein', () => {
    expect(errors({ ...prod, STRIPE_SECRET_KEY: 'rk_live_x' })).toEqual([])
    for (const key of ['sk_test_x', 'rk_test_x', 'sk_test_proxy']) {
      expect(errors({ ...prod, STRIPE_SECRET_KEY: key }), key).toEqual([
        'STRIPE_SECRET_KEY muss mit sk_live_ oder rk_live_ beginnen.',
      ])
    }
    expect(errors({ ...prod, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_x' })).toEqual([
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY muss mit pk_live_ beginnen.',
    ])
  })

  it('AK-A-3-02 T-17 STRIPE_WEBHOOK_SECRET ohne whsec_ in Produktion → Abbruch', () => {
    expect(errors({ ...prod, STRIPE_WEBHOOK_SECRET: '' })).toEqual([
      'STRIPE_WEBHOOK_SECRET muss mit whsec_ beginnen.',
    ])
  })

  it('T-17 STRIPE_API_BASE_URL (stripe-mock) ist in Produktion verboten, außerhalb erlaubt', () => {
    expect(errors({ ...prod, STRIPE_API_BASE_URL: 'http://127.0.0.1:12111' })).toEqual([
      'STRIPE_API_BASE_URL ist in Produktion verboten (nur Tests gegen stripe-mock).',
    ])
    for (const appEnv of NON_PROD) {
      expect(nonProd(appEnv, { STRIPE_API_BASE_URL: 'http://127.0.0.1:12111' })).toEqual([])
    }
  })

  it('AK-A-3-02 alle Zahlungsverstöße erscheinen gemeinsam in einer Meldung', () => {
    let message = ''
    try {
      assertProductionEnv(
        parseEnv({
          ...prod,
          PAYMENTS_DRIVER: 'mock',
          STRIPE_SECRET_KEY: 'sk_test_x',
          STRIPE_WEBHOOK_SECRET: 'x',
          NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_x',
        }),
      )
    } catch (e) {
      message = (e as Error).message
    }
    for (const name of [
      'PAYMENTS_DRIVER',
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    ]) {
      expect(message).toContain(name)
    }
  })
})
