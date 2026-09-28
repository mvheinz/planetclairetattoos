// Export-Umgebung der Vorschau-Datei (ARCHITEKTUR §14.3, KONZEPT §12.3 Nr. 1). Rein und ohne Seiteneffekte: `index.ts`
// reicht das Ergebnis an Datenbank-, Build- und Server-Schritte weiter (Kindprozesse), die App liest es über
// `getEnv()`. Skripte dürfen `process.env` vor dem App-Start lesen (ARCHITEKTUR §5.1).
import { TZDate } from '@date-fns/tz'
import { format } from 'date-fns'

export const EXPORT_DB_NAME = 'planetclaire_preview_export'
export const EXPORT_HOST = '127.0.0.1'
export const EXPORT_PORT = 3999
export const EXPORT_ORIGIN = `http://${EXPORT_HOST}:${EXPORT_PORT}`
export const EXPORT_DIST_DIR = '.next-preview'
export const EXPORT_STORAGE_DIR = '.data/preview-export'
export const EXPORT_ADMIN_ROUTE = '/werkstatt'
export const OUTPUT_DIR = 'dist'
export const OUTPUT_HTML = 'planet-claire-vorschau.html'
export const OUTPUT_REPORT = 'planet-claire-vorschau.report.json'

/** Nur für die Wegwerf-Datenbank des Exports; echte Geheimnisse braucht der Export nie (KONZEPT §12.2). */
const FALLBACK_PAYLOAD_SECRET = 'preview-export-only-not-a-secret-000000'

/** Berliner Kalenderdatum `YYYY-MM-DD` des Exports. */
export function exportDateKey(now: Date): string {
  return format(new TZDate(now.getTime(), 'Europe/Berlin'), 'yyyy-MM-dd')
}

/** `SEED_NOW` = Exportdatum 12:00 in Berlin mit Berliner Offset, z. B. `2026-09-28T12:00:00+02:00`. */
export function exportSeedNow(now: Date): string {
  const [y, m, d] = exportDateKey(now).split('-').map(Number) as [number, number, number]
  const noon = new TZDate(y, m - 1, d, 12, 0, 0, 'Europe/Berlin')
  return format(noon, "yyyy-MM-dd'T'HH:mm:ssxxx")
}

/** Gleicher Postgres-Server wie `sourceUrl`, aber Datenbank `planetclaire_preview_export`. */
export function exportDatabaseUrl(sourceUrl: string): string {
  const u = new URL(sourceUrl)
  u.pathname = `/${EXPORT_DB_NAME}`
  u.search = ''
  return u.toString()
}

/** Verbindung zur Wartungsdatenbank `postgres` desselben Servers (Anlegen der Export-Datenbank). */
export function maintenanceDatabaseUrl(sourceUrl: string): string {
  const u = new URL(sourceUrl)
  u.pathname = '/postgres'
  return u.toString()
}

export interface ExportEnvInput {
  /** Umgebung des Aufrufs (inkl. `.env`); liefert Server-URL, `PAYLOAD_SECRET`, `PATH` usw. */
  source: Readonly<Record<string, string | undefined>>
  /** Testwerte aus `.env.example` (`SEED_ADMIN_*`), ARCHITEKTUR §14.7. */
  example: Readonly<Record<string, string | undefined>>
  now: Date
  /** Phasen-Kennung (§14.9), z. B. `p2`. */
  phase: string
}

/** Variablen, die aus der Aufruf-Umgebung nie in den Export gelangen (Debug, Fremddienste, echte Schlüssel). */
export const DROPPED_VARS = [
  'NEXT_PUBLIC_LEASH_DEBUG',
  'DATABASE_URL_TEST',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'DEEPL_API_KEY',
  'S3_ENDPOINT',
  'S3_BUCKET',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASS',
  'NEXT_PUBLIC_SENTRY_DSN',
  'SENTRY_AUTH_TOKEN',
  'E2E_SERVER',
  'E2E_BASE_URL',
] as const

/** Vollständige Export-Umgebung laut ARCHITEKTUR §14.3. */
export function buildExportEnv(input: ExportEnvInput): Record<string, string> {
  const sourceUrl = input.source.DATABASE_URL_UNPOOLED || input.source.DATABASE_URL
  if (!sourceUrl) throw new Error('DATABASE_URL fehlt.')
  const dbUrl = exportDatabaseUrl(sourceUrl)
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(input.source)) if (v !== undefined) env[k] = v
  for (const k of DROPPED_VARS) delete env[k]
  // `next build`/`next start` setzen NODE_ENV selbst; ein geerbtes `test` (Vitest) würde den Build stören.
  delete env.NODE_ENV
  Object.assign(env, {
    APP_ENV: 'preview',
    PREVIEW_EXPORT: 'true',
    SEED_PREVIEW_MODE: 'true',
    PAYMENTS_DRIVER: 'mock',
    EMAIL_DRIVER: 'memory',
    STORAGE_DRIVER: 'local',
    STORAGE_LOCAL_DIR: EXPORT_STORAGE_DIR,
    TRANSLATION_DRIVER: 'mock',
    SEED_NOW: exportSeedNow(input.now),
    NEXT_PUBLIC_SITE_URL: EXPORT_ORIGIN,
    DATABASE_URL: dbUrl,
    DATABASE_URL_UNPOOLED: dbUrl,
    PAYLOAD_DB_PUSH: 'false',
    PAYLOAD_SECRET: input.source.PAYLOAD_SECRET || FALLBACK_PAYLOAD_SECRET,
    JOBS_AUTORUN: 'false',
    NEXT_PUBLIC_ANALYTICS_ENABLED: 'false',
    NEXT_PUBLIC_CLIENT_ERRORS_ENABLED: 'false',
    SENTRY_DSN: '',
    ADMIN_ROUTE: EXPORT_ADMIN_ROUTE,
    NEXT_DIST_DIR: EXPORT_DIST_DIR,
    NEXT_TELEMETRY_DISABLED: '1',
    TZ: 'UTC',
    PREVIEW_PHASE: input.phase.toUpperCase(),
    SEED_ADMIN_EMAIL: input.example.SEED_ADMIN_EMAIL || 'admin@example.com',
    SEED_ADMIN_PASSWORD: input.example.SEED_ADMIN_PASSWORD || 'werkstatt-dev-2026',
  })
  return env
}
