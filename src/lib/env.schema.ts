// Registry aller Umgebungsvariablen (ARCHITEKTUR §5.1/§5.2). Reines Modul ohne `server-only`, damit
// scripts/gen-env-example.ts und Tests es laden können; die App liest Werte nur über getEnv() aus src/lib/env.ts.
import { z } from 'zod'

export type EnvGroup =
  | 'Kern und Laufzeit'
  | 'Beispielbestand, Vorschau, QA'
  | 'Speicher'
  | 'E-Mail'
  | 'Zahlung'
  | 'Übersetzung, Versand, Statistik, Monitoring'
  | 'Backup (nur Produktion, §10)'
  | 'Build und Test'

export interface EnvVarDef<S extends z.ZodType = z.ZodType> {
  name: string
  group: EnvGroup
  description: string
  /** Wert in `.env.example` (Geheimnisse leer, außer ausdrücklich erlaubte Platzhalter). */
  example: string
  secret: boolean
  since: `P${number}`
  schema: S
}

const boolish = z.enum(['true', 'false', '1', '0', '']).transform((v) => v === 'true' || v === '1')

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v === '' ? undefined : v))

const isoWithOffset = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/,
    'SEED_NOW muss ISO 8601 mit Zeitzonen-Offset sein, z. B. 2026-10-15T10:00:00+02:00',
  )
  .refine((v) => !Number.isNaN(Date.parse(v)), 'SEED_NOW ist kein gültiges Datum')

const def = <N extends string, S extends z.ZodType>(
  name: N,
  group: EnvGroup,
  since: `P${number}`,
  description: string,
  example: string,
  schema: S,
  secret = false,
): EnvVarDef<S> & { name: N } => ({ name, group, since, description, example, schema, secret })

const K: EnvGroup = 'Kern und Laufzeit'
const S: EnvGroup = 'Beispielbestand, Vorschau, QA'
const ST: EnvGroup = 'Speicher'
const M: EnvGroup = 'E-Mail'
const Z: EnvGroup = 'Zahlung'
const U: EnvGroup = 'Übersetzung, Versand, Statistik, Monitoring'
const B: EnvGroup = 'Backup (nur Produktion, §10)'
const T: EnvGroup = 'Build und Test'

export const APP_ENVS = ['development', 'test', 'preview', 'staging', 'production'] as const
export type AppEnv = (typeof APP_ENVS)[number]

const DEFS = [
  // Kern und Laufzeit
  def(
    'APP_ENV',
    K,
    'P1',
    'Umgebungskennung: development | test | preview | staging | production (ARCHITEKTUR §4.2)',
    'development',
    z.enum(APP_ENVS).default('development'),
  ),
  def(
    'DATABASE_URL',
    K,
    'P0',
    'Postgres-Verbindung der App (Neon: gepoolte URL mit -pooler)',
    'postgres://postgres:postgres@127.0.0.1:5432/planetclaire',
    z.string().min(1).default('postgres://postgres:postgres@127.0.0.1:5432/planetclaire'),
    true,
  ),
  def(
    'DATABASE_URL_UNPOOLED',
    K,
    'P1',
    'Direkte Verbindung für Migrationen, Backup, db:*-Skripte (leer = DATABASE_URL)',
    '',
    optionalString,
    true,
  ),
  def(
    'DATABASE_URL_TEST',
    K,
    'P1',
    'Test-Datenbank für test:int/test:e2e – wird geleert!',
    'postgres://postgres:postgres@127.0.0.1:5432/planetclaire_test',
    optionalString,
  ),
  def(
    'DB_POOL_MAX',
    K,
    'P1',
    'Größe des pg-Pools (Int-Tests 25, Vercel 5)',
    '10',
    z.coerce.number().int().min(1).max(100).default(10),
  ),
  def(
    'PAYLOAD_SECRET',
    K,
    'P0',
    'Payload-Signaturen und Wurzel für abgeleitete Schlüssel (HKDF, ARCHITEKTUR §8.6); mindestens 32 zufällige Zeichen',
    'change-me-dev-only-0000000000000000',
    z.string().min(1),
    true,
  ),
  def(
    'PAYLOAD_DB_PUSH',
    K,
    'P1',
    'Schema-Push, nur auf einer Wegwerf-Datenbank lokal',
    'false',
    boolish.default(false),
  ),
  def(
    'NEXT_PUBLIC_SITE_URL',
    K,
    'P0',
    'Kanonische Basis-URL ohne / am Ende',
    'http://localhost:3000',
    z
      .url()
      .refine((v) => !v.endsWith('/'), 'ohne / am Ende')
      .default('http://localhost:3000'),
  ),
  def(
    'ADMIN_ROUTE',
    K,
    'P1',
    'Pfad der Verwaltung (nicht /admin, E-93)',
    '/werkstatt',
    z
      .string()
      .regex(/^\/[a-z0-9-]+$/, 'ADMIN_ROUTE beginnt mit / und enthält nur a-z, 0-9 und -')
      .default('/werkstatt'),
  ),
  def(
    'CRON_SECRET',
    K,
    'P1',
    'Bearer für /api/cron/*, /api/health?deep=1, /api/payload-jobs/run (mindestens 32 Zeichen)',
    'dev-only-cron-secret-change-me-0000000000',
    z.string().optional(),
    true,
  ),
  def(
    'JOBS_AUTORUN',
    K,
    'P1',
    'Payload jobs.autoRun im Prozess (true lokal/Docker, false Vercel/Tests)',
    'true',
    boolish.default(false),
  ),
  def(
    'LOG_LEVEL',
    K,
    'P1',
    'Log-Stufe: debug | info | warn | error',
    'info',
    z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  ),
  def(
    'MAINTENANCE_MODE',
    K,
    'P10',
    'Wartungsmodus (ARCHITEKTUR §10.5)',
    'false',
    boolish.default(false),
  ),
  def(
    'TZ',
    K,
    'P1',
    'Prozess-Zeitzone, immer UTC (Code rechnet mit Europe/Berlin)',
    'UTC',
    z.string().default('UTC'),
  ),
  // Beispielbestand, Vorschau, QA
  def(
    'SEED_PREVIEW_MODE',
    S,
    'P0',
    'Seed-Medien ohne Einwilligung und Banner zeigen (nie in Produktion, R-181)',
    'true',
    boolish.default(false),
  ),
  def(
    'SEED_NOW',
    S,
    'P1',
    'Referenzzeit des Beispielbestands (ISO 8601 mit Offset; leer = jetzt)',
    '',
    isoWithOffset.optional().or(z.literal('').transform(() => undefined)),
  ),
  def(
    'SEED_ADMIN_EMAIL',
    S,
    'P1',
    'Admin-Konto des Grund-Seeds (nur außerhalb von Produktion)',
    'admin@example.com',
    z
      .email()
      .optional()
      .or(z.literal('').transform(() => undefined)),
  ),
  def(
    'SEED_ADMIN_PASSWORD',
    S,
    'P1',
    'Passwort dazu (nur Testwert, mindestens 12 Zeichen)',
    'werkstatt-dev-2026',
    z
      .string()
      .min(12, 'SEED_ADMIN_PASSWORD braucht mindestens 12 Zeichen')
      .optional()
      .or(z.literal('').transform(() => undefined)),
  ),
  def(
    'PREVIEW_EXPORT',
    S,
    'P2',
    'Export-Modus der Vorschau-Datei (Kasse als Attrappe, keine Analytics)',
    'false',
    boolish.default(false),
  ),
  def(
    'PREVIEW_PHASE',
    S,
    'P2',
    'Phasen-Kennung für Banner, Bericht und Artefakt-Namen (leer = aus PLAN.md)',
    '',
    optionalString,
  ),
  def(
    'NEXT_PUBLIC_LEASH_DEBUG',
    S,
    'P2',
    'window.__leash/window.__qa einbauen (DESIGN §9.13)',
    '',
    boolish.optional(),
  ),
  def('ART_QA', S, 'P9', 'QA-Seiten /{locale}/qa/* (KUNST-QA §3.1)', '', boolish.optional()),
  // Speicher
  def(
    'STORAGE_DRIVER',
    ST,
    'P0',
    'Speicher-Treiber: local | s3',
    'local',
    z.enum(['local', 's3']).default('local'),
  ),
  def(
    'STORAGE_LOCAL_DIR',
    ST,
    'P1',
    'Wurzelordner für local',
    '.data',
    z.string().default('.data'),
  ),
  def(
    'S3_ENDPOINT',
    ST,
    'P0',
    'S3-Endpunkt (R2: https://<ACCOUNT_ID>.eu.r2.cloudflarestorage.com)',
    '',
    optionalString,
  ),
  def('S3_REGION', ST, 'P0', 'Region', 'auto', z.string().default('auto')),
  def('S3_BUCKET', ST, 'P0', 'Bucket für media und documents', '', optionalString),
  def(
    'S3_PRIVATE_BUCKET',
    ST,
    'P1',
    'Bucket für private-uploads und Systemdateien',
    '',
    optionalString,
  ),
  def(
    'S3_ACCESS_KEY_ID',
    ST,
    'P0',
    'Zugangsschlüssel (R2-Token nur für diese zwei Buckets)',
    '',
    optionalString,
    true,
  ),
  def('S3_SECRET_ACCESS_KEY', ST, 'P0', 'Geheimnis dazu', '', optionalString, true),
  def(
    'S3_FORCE_PATH_STYLE',
    ST,
    'P1',
    'Pfad-Adressierung (R2/MinIO)',
    'true',
    boolish.default(true),
  ),
  // E-Mail
  def(
    'EMAIL_DRIVER',
    M,
    'P0',
    'Mail-Treiber: file | smtp | memory | log',
    'file',
    z.enum(['file', 'smtp', 'memory', 'log']).default('file'),
  ),
  def(
    'EMAIL_FILE_DIR',
    M,
    'P1',
    'Ablage für den Treiber file',
    '.data/mail-outbox',
    z.string().default('.data/mail-outbox'),
  ),
  def(
    'SMTP_HOST',
    M,
    'P0',
    'SMTP-Server (Mailpit lokal, Lettermint in Produktion)',
    '127.0.0.1',
    z.string().default('127.0.0.1'),
  ),
  def(
    'SMTP_PORT',
    M,
    'P0',
    'Port (1025 Mailpit, 587 STARTTLS oder 465)',
    '1025',
    z.coerce.number().int().min(1).max(65535).default(1025),
  ),
  def('SMTP_SECURE', M, 'P1', 'true nur bei Port 465', 'false', boolish.default(false)),
  def('SMTP_USER', M, 'P0', 'SMTP-Benutzer', '', optionalString, true),
  def('SMTP_PASS', M, 'P0', 'SMTP-Passwort/Token', '', optionalString, true),
  def(
    'MAIL_FROM',
    M,
    'P0',
    'Absender',
    '"Planet Claire <shop@planetclairetattoos.com>"',
    z.string().default('Planet Claire <shop@planetclairetattoos.com>'),
  ),
  def(
    'MAIL_REPLY_TO',
    M,
    'P0',
    'Antwortadresse',
    'jutta@planetclairetattoos.com',
    z.email().default('jutta@planetclairetattoos.com'),
  ),
  def(
    'ADMIN_NOTIFY_EMAIL',
    M,
    'P0',
    'Startwert/Rückfall für settings.adminNotificationEmail',
    'jutta@planetclairetattoos.com',
    z.email().default('jutta@planetclairetattoos.com'),
  ),
  def(
    'MAIL_REDIRECT_ALL_TO',
    M,
    'P11',
    'Alle Mails an diese Adresse (nur außerhalb von Produktion)',
    '',
    z
      .email()
      .optional()
      .or(z.literal('').transform(() => undefined)),
  ),
  // Zahlung
  def(
    'PAYMENTS_DRIVER',
    Z,
    'P0',
    'Zahlungs-Treiber: mock | stripe',
    'mock',
    z.enum(['mock', 'stripe']).default('mock'),
  ),
  def(
    'STRIPE_SECRET_KEY',
    Z,
    'P0',
    'Stripe-Server-Schlüssel (sk_test_/rk_test_; Live nur in Produktion)',
    '',
    optionalString,
    true,
  ),
  def(
    'STRIPE_WEBHOOK_SECRET',
    Z,
    'P0',
    'Signatur-Geheimnis des Webhook-Endpunkts (whsec_…)',
    '',
    optionalString,
    true,
  ),
  def(
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    Z,
    'P0',
    'Stripe-Browser-Schlüssel (nur Kasse)',
    '',
    optionalString,
  ),
  def('STRIPE_API_BASE_URL', Z, 'P4', 'Nur Tests gegen stripe-mock', '', optionalString),
  // Übersetzung, Versand, Statistik, Monitoring
  def(
    'TRANSLATION_DRIVER',
    U,
    'P0',
    'Übersetzungs-Treiber: mock | deepl',
    'mock',
    z.enum(['mock', 'deepl']).default('mock'),
  ),
  def('DEEPL_API_KEY', U, 'P0', 'DeepL API Free (…:fx)', '', optionalString, true),
  def(
    'CARRIER_DRIVER',
    U,
    'P1',
    'Versanddienst-Adapter: manual',
    'manual',
    z.enum(['manual']).default('manual'),
  ),
  def(
    'NEXT_PUBLIC_ANALYTICS_ENABLED',
    U,
    'P1',
    'Vercel Web Analytics rendern (wirksam ab P10)',
    'false',
    boolish.default(false),
  ),
  def(
    'NEXT_PUBLIC_CLIENT_ERRORS_ENABLED',
    U,
    'P10',
    'Browser-Fehlermeldungen an POST /api/client-errors (nur Produktion, nach K-30 c)',
    'false',
    boolish.default(false),
  ),
  def('SENTRY_DSN', U, 'P0', 'Sentry EU, leer = aus', '', optionalString, true),
  def(
    'SENTRY_ENVIRONMENT',
    U,
    'P10',
    'Umgebungsname in Sentry (leer = APP_ENV)',
    '',
    optionalString,
  ),
  // Backup
  def('BACKUP_ENABLED', B, 'P10', 'Nächtliches Backup aktiv', 'false', boolish.default(false)),
  def('BACKUP_S3_BUCKET', B, 'P10', 'Backup-Bucket (EU)', '', optionalString),
  def(
    'BACKUP_S3_ACCESS_KEY_ID',
    B,
    'P10',
    'Eigener R2-Token nur für den Backup-Bucket',
    '',
    optionalString,
    true,
  ),
  def('BACKUP_S3_SECRET_ACCESS_KEY', B, 'P10', 'Geheimnis dazu', '', optionalString, true),
  def(
    'BACKUP_AGE_RECIPIENT',
    B,
    'P10',
    'Öffentlicher age-Schlüssel (age1…) für die Verschlüsselung',
    '',
    optionalString,
  ),
  // Build und Test
  def('NEXT_OUTPUT_STANDALONE', T, 'P0', 'output: standalone (Docker)', '', optionalString),
  def('BUILD_WITHOUT_DB', T, 'P10', 'Build ohne DB-Zugriff (Docker)', '', boolish.optional()),
  def('NEXT_TELEMETRY_DISABLED', T, 'P0', 'Next-Telemetrie aus', '1', optionalString),
  def(
    'NEXT_DIST_DIR',
    T,
    'P2',
    'Build-Ordner (leer = .next; Vorschau-Export .next-preview)',
    '',
    optionalString,
  ),
  def(
    'E2E_BASE_URL',
    T,
    'P1',
    'Ziel der E2E-Tests',
    'http://localhost:3000',
    z.url().default('http://localhost:3000'),
  ),
  def(
    'E2E_SERVER',
    T,
    'P1',
    'dev (lokal) oder start (CI: Produktions-Build)',
    'dev',
    z.enum(['dev', 'start']).default('dev'),
  ),
  def(
    'PW_SKIP_WEBKIT',
    T,
    'P1',
    'Nur wenn die WebKit-Installation scheitert (nie in CI)',
    '',
    boolish.optional(),
  ),
] as const

export const ENV_VARS: readonly EnvVarDef[] = DEFS

type Defs = (typeof DEFS)[number]
type Shape = { [D in Defs as D['name']]: D['schema'] }

/** Von Plattformen gesetzt und nur gelesen (ARCHITEKTUR §5.2, nicht in .env.example). */
export const PLATFORM_VARS = z.object({
  NODE_ENV: z.string().optional(),
  CI: z.string().optional(),
  VERCEL_ENV: z.string().optional(),
  VERCEL_GIT_COMMIT_SHA: z.string().optional(),
  VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
})

const shape = Object.fromEntries(
  DEFS.map((v) => [v.name, v.schema.describe(v.description)]),
) as unknown as Shape

export const envSchema = z.object(shape).extend(PLATFORM_VARS.shape)

/** Platzhalter aus `.env.example`, die in Produktion nie gelten dürfen. */
export const EXAMPLE_PAYLOAD_SECRET = 'change-me-dev-only-0000000000000000'

const ENV_HEADER = `# Beispiel-Konfiguration. Kopieren nach \`.env\` (wird nie committet).
# ERZEUGT aus src/lib/env.schema.ts mit \`pnpm env:example\` – nicht von Hand ändern.
# Beschreibung aller Variablen: docs/ARCHITEKTUR.md §5.2.
# Bis zum Go-live (P11) laufen alle Integrationen über lokale Treiber/Mocks – keine echten Schlüssel nötig.
`

/** Erzeugt den Inhalt von `.env.example` (C-14 Nr. 2), gruppiert wie ARCHITEKTUR §5.2. */
export function renderEnvExample(): string {
  const lines: string[] = [ENV_HEADER]
  let group: EnvGroup | undefined
  for (const v of ENV_VARS) {
    if (v.group !== group) {
      group = v.group
      lines.push('', `# --- ${group} ---`)
    }
    lines.push(`# ${v.description}${v.secret ? ' (geheim)' : ''} · seit ${v.since}`)
    lines.push(`${v.name}=${v.example}`)
  }
  return lines.join('\n') + '\n'
}
