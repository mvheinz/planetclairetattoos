import 'server-only'

import { z } from 'zod'

import { EXAMPLE_PAYLOAD_SECRET, envSchema, type AppEnv } from './env.schema'

// Einzige Stelle, an der die App process.env liest (ARCHITEKTUR §5.1, AK-A-5-02).

export type Env = Readonly<z.output<typeof envSchema>> & { APP_ENV: AppEnv }

export interface EnvReport {
  errors: string[]
  warnings: string[]
}

let cached: Env | undefined

/** Parst eine Variablen-Quelle; Formatfehler brechen immer ab (ARCHITEKTUR §4.3). */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source)
  if (!result.success) {
    const lines = result.error.issues.map((i) => `- ${i.path.join('.') || '(env)'}: ${i.message}`)
    throw new Error(`Ungültige Umgebungsvariablen:\n${lines.join('\n')}`)
  }
  return Object.freeze(result.data) as Env
}

/** Einmal geparst und gecacht. */
export function getEnv(): Env {
  if (!cached) cached = parseEnv(process.env)
  return cached
}

/** Nur für Tests: Cache leeren. */
export function resetEnvCache(): void {
  cached = undefined
}

const ADMIN_ROUTE_PROD = /^\/[a-z0-9-]{5,39}$/
const PROD_SITE_URL = 'https://planetclairetattoos.com'

/**
 * Sammelt alle Verstöße gegen die Start-Regeln (ARCHITEKTUR §4.2/§4.3, T-17).
 * Live-Schlüssel außerhalb von Produktion sind immer ein Fehler (AK-1-02, CLAUDE.md §6).
 */
export function collectEnvViolations(env: Env): EnvReport {
  const errors: string[] = []
  const warnings: string[] = []
  const prod = env.APP_ENV === 'production'
  const sk = env.STRIPE_SECRET_KEY ?? ''
  const pk = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''

  if (!prod) {
    if (/^(sk|rk)_live_/.test(sk))
      errors.push('STRIPE_SECRET_KEY: Live-Schlüssel außerhalb von Produktion verboten.')
    else if (sk && !/^(sk|rk)_test_/.test(sk))
      errors.push(
        'STRIPE_SECRET_KEY muss außerhalb von Produktion mit sk_test_ oder rk_test_ beginnen.',
      )
    if (/^pk_live_/.test(pk))
      errors.push(
        'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: Live-Schlüssel außerhalb von Produktion verboten.',
      )
    else if (pk && !pk.startsWith('pk_test_'))
      errors.push(
        'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY muss außerhalb von Produktion mit pk_test_ beginnen.',
      )
    if (
      env.CRON_SECRET !== undefined &&
      env.CRON_SECRET.length > 0 &&
      env.CRON_SECRET.length < 32
    ) {
      errors.push('CRON_SECRET: mindestens 32 Zeichen.')
    }
    return { errors, warnings }
  }

  if (env.STORAGE_DRIVER !== 's3') errors.push('STORAGE_DRIVER muss in Produktion s3 sein.')
  if (env.EMAIL_DRIVER !== 'smtp') errors.push('EMAIL_DRIVER muss in Produktion smtp sein.')
  if (env.PAYMENTS_DRIVER !== 'stripe')
    errors.push('PAYMENTS_DRIVER muss in Produktion stripe sein.')
  if (env.TRANSLATION_DRIVER !== 'deepl') {
    warnings.push('TRANSLATION_DRIVER ist nicht deepl – der Übersetzen-Knopf ist deaktiviert.')
  }
  if (!/^(sk|rk)_live_/.test(sk))
    errors.push('STRIPE_SECRET_KEY muss mit sk_live_ oder rk_live_ beginnen.')
  if (!(env.STRIPE_WEBHOOK_SECRET ?? '').startsWith('whsec_')) {
    errors.push('STRIPE_WEBHOOK_SECRET muss mit whsec_ beginnen.')
  }
  if (!pk.startsWith('pk_live_'))
    errors.push('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY muss mit pk_live_ beginnen.')
  if (env.PAYLOAD_SECRET.length < 32) errors.push('PAYLOAD_SECRET: mindestens 32 Zeichen.')
  if (env.PAYLOAD_SECRET === EXAMPLE_PAYLOAD_SECRET) {
    errors.push('PAYLOAD_SECRET darf nicht der Wert aus .env.example sein.')
  }
  if ((env.CRON_SECRET ?? '').length < 32) errors.push('CRON_SECRET: mindestens 32 Zeichen.')
  if (
    env.ADMIN_ROUTE === '/admin' ||
    env.ADMIN_ROUTE === '/werkstatt' ||
    !ADMIN_ROUTE_PROD.test(env.ADMIN_ROUTE)
  ) {
    errors.push(
      'ADMIN_ROUTE: eigener Pfad nötig (nicht /admin oder /werkstatt, nur a-z 0-9 -, 6–40 Zeichen).',
    )
  }
  if (env.NEXT_PUBLIC_SITE_URL !== PROD_SITE_URL)
    errors.push(`NEXT_PUBLIC_SITE_URL muss ${PROD_SITE_URL} sein.`)
  if (!/^https:\/\/[a-z0-9-]+\.eu\.r2\.cloudflarestorage\.com\/?$/.test(env.S3_ENDPOINT ?? '')) {
    errors.push('S3_ENDPOINT muss in der EU-Jurisdiktion liegen (*.eu.r2.cloudflarestorage.com).')
  }
  if (env.SEED_PREVIEW_MODE)
    errors.push('SEED_PREVIEW_MODE=true ist in Produktion verboten (R-181).')
  return { errors, warnings }
}

/** Bricht mit einer Meldung ab, die alle Verstöße enthält (AK-A-3-02). */
export function assertProductionEnv(env: Env): EnvReport {
  const report = collectEnvViolations(env)
  if (report.errors.length > 0) {
    throw new Error(
      `Start abgebrochen – Umgebung ungültig:\n${report.errors.map((e) => `- ${e}`).join('\n')}`,
    )
  }
  return report
}

/** SEED_PREVIEW_MODE wirkt nur außerhalb von Produktion (KONZEPT §9.7). */
export function seedPreviewModeActive(env: Env = getEnv()): boolean {
  return env.APP_ENV !== 'production' && env.SEED_PREVIEW_MODE === true
}

export function isProduction(env: Env = getEnv()): boolean {
  return env.APP_ENV === 'production'
}
