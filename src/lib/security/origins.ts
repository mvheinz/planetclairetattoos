import 'server-only'

import type { Env } from '@/lib/env'

// Zugelassene Origins für Payloads `cors` und `csrf` (ARCHITEKTUR §8.2, C-26, PLAN P10.13): die kanonische Adresse
// (`NEXT_PUBLIC_SITE_URL`) und – nur bei `APP_ENV=production` – die Vercel-Produktions-Domain
// (Schema + `VERCEL_PROJECT_PRODUCTION_URL`), damit die Verwaltung vor der DNS-Umstellung unter `<projekt>.vercel.app`
// bedienbar ist. Kanonische URLs, Sitemap und Mail-Links bleiben auf `NEXT_PUBLIC_SITE_URL`.

const SCHEME = 'https:'

const originOf = (url: string): string | null => {
  try {
    return new URL(/^https?:\/\//.test(url) ? url : `${SCHEME}//${url}`).origin
  } catch {
    return null
  }
}

export function allowedOrigins(
  env: Pick<Env, 'NEXT_PUBLIC_SITE_URL' | 'APP_ENV' | 'VERCEL_PROJECT_PRODUCTION_URL'>,
): string[] {
  const out = new Set<string>()
  const site = originOf(env.NEXT_PUBLIC_SITE_URL)
  if (site) out.add(site)
  if (env.APP_ENV === 'production' && env.VERCEL_PROJECT_PRODUCTION_URL) {
    const vercel = originOf(env.VERCEL_PROJECT_PRODUCTION_URL)
    if (vercel) out.add(vercel)
  }
  return [...out]
}

/** Umgebungen mit festen Origin-Listen. Lokal und in Tests (E2E auf wechselnden Ports) gelten Payloads Standardwerte. */
export const originListsApply = (env: Pick<Env, 'APP_ENV'>): boolean =>
  env.APP_ENV === 'production' || env.APP_ENV === 'staging' || env.APP_ENV === 'preview'
