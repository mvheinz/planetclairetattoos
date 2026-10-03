import { describe, expect, it } from 'vitest'

import {
  EXPORT_DB_NAME,
  buildExportEnv,
  exportDatabaseUrl,
  exportDateKey,
  exportSeedNow,
} from '../../../scripts/preview-export/env'

const source = {
  DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:5432/planetclaire',
  DATABASE_URL_UNPOOLED: '',
  DATABASE_URL_TEST: 'postgres://postgres:postgres@127.0.0.1:5432/planetclaire_test',
  PAYLOAD_SECRET: 'x'.repeat(40),
  NEXT_PUBLIC_LEASH_DEBUG: '1',
  STRIPE_SECRET_KEY: 'sk_test_123',
  EMAIL_DRIVER: 'smtp',
  PATH: '/usr/bin',
  NODE_ENV: 'test',
}
const example = { SEED_ADMIN_EMAIL: 'admin@example.com', SEED_ADMIN_PASSWORD: 'werkstatt-dev-2026' }

describe('Vorschau-Export: Umgebung (ARCHITEKTUR §14.3)', () => {
  it('SEED_NOW = Exportdatum 12:00 Berlin mit Berliner Offset (Sommer- und Winterzeit)', () => {
    expect(exportSeedNow(new Date('2026-09-28T03:00:00Z'))).toBe('2026-09-28T12:00:00+02:00')
    expect(exportSeedNow(new Date('2026-12-01T10:00:00Z'))).toBe('2026-12-01T12:00:00+01:00')
    // 23:30 UTC am 30.09. ist in Berlin schon der 01.10.
    expect(exportDateKey(new Date('2026-09-30T23:30:00Z'))).toBe('2026-10-01')
    expect(exportSeedNow(new Date('2026-09-30T23:30:00Z'))).toBe('2026-10-01T12:00:00+02:00')
  })

  it('Export-Datenbank auf dem Server aus DATABASE_URL', () => {
    expect(exportDatabaseUrl('postgres://u:p@db.local:6543/planetclaire?sslmode=disable')).toBe(
      `postgres://u:p@db.local:6543/${EXPORT_DB_NAME}`,
    )
  })

  it('setzt alle Variablen aus §14.3', () => {
    const env = buildExportEnv({
      source,
      example,
      now: new Date('2026-09-28T08:00:00Z'),
      phase: 'p2',
    })
    expect(env).toMatchObject({
      APP_ENV: 'preview',
      PREVIEW_EXPORT: 'true',
      SEED_PREVIEW_MODE: 'true',
      PAYMENTS_DRIVER: 'mock',
      EMAIL_DRIVER: 'memory',
      STORAGE_DRIVER: 'local',
      STORAGE_LOCAL_DIR: '.data/preview-export',
      TRANSLATION_DRIVER: 'mock',
      SEED_NOW: '2026-09-28T12:00:00+02:00',
      NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3999',
      DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:5432/${EXPORT_DB_NAME}`,
      DATABASE_URL_UNPOOLED: `postgres://postgres:postgres@127.0.0.1:5432/${EXPORT_DB_NAME}`,
      JOBS_AUTORUN: 'false',
      NEXT_PUBLIC_ANALYTICS_ENABLED: 'false',
      NEXT_PUBLIC_CLIENT_ERRORS_ENABLED: 'false',
      SENTRY_DSN: '',
      ADMIN_ROUTE: '/werkstatt',
      NEXT_DIST_DIR: '.next-preview',
      NEXT_TELEMETRY_DISABLED: '1',
      TZ: 'UTC',
      PREVIEW_PHASE: 'P2',
      SEED_ADMIN_EMAIL: 'admin@example.com',
      SEED_ADMIN_PASSWORD: 'werkstatt-dev-2026',
      PATH: '/usr/bin',
    })
  })

  it('ohne Debug-Flag, ohne Test-DB, ohne Fremddienst-Schlüssel und ohne geerbtes NODE_ENV', () => {
    const env = buildExportEnv({ source, example, now: new Date(), phase: 'px' })
    expect(env.NEXT_PUBLIC_LEASH_DEBUG).toBeUndefined()
    expect(env.DATABASE_URL_TEST).toBeUndefined()
    expect(env.STRIPE_SECRET_KEY).toBeUndefined()
    expect(env.NODE_ENV).toBeUndefined()
  })

  it('ohne DATABASE_URL → Fehler', () => {
    expect(() => buildExportEnv({ source: {}, example, now: new Date(), phase: 'px' })).toThrow(
      /DATABASE_URL/,
    )
  })
})

describe('Eigene Export-Datenbank/Port für parallele Läufe (PREVIEW_EXPORT_DB_NAME/PORT, P8.21)', () => {
  it('Standard ohne Angabe; gültige Umlenkung; ungültige Namen und Ports abgelehnt', async () => {
    const { resolveExportTarget } = await import('../../../scripts/preview-export/env')
    expect(resolveExportTarget({})).toEqual({ dbName: 'planetclaire_preview_export', port: 3999 })
    expect(
      resolveExportTarget({
        PREVIEW_EXPORT_DB_NAME: 'planetclaire_c_preview',
        PREVIEW_EXPORT_PORT: '3998',
      }),
    ).toEqual({ dbName: 'planetclaire_c_preview', port: 3998 })
    for (const bad of ['planetclaire', 'planetclaire_test', 'postgres', 'planetclaire_c; drop'])
      expect(() => resolveExportTarget({ PREVIEW_EXPORT_DB_NAME: bad })).toThrow()
    for (const bad of ['80', 'abc', '70000'])
      expect(() => resolveExportTarget({ PREVIEW_EXPORT_PORT: bad })).toThrow()
  })
})
