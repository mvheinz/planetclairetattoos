// Freigabe der Statistik (PLAN P10.11, R-210 Nr. 10): nur wenn alle vier Bedingungen erfüllt sind – Umgebungsschalter,
// Produktion, kein Vorschau-Export und die dokumentierte Entscheidung in den Einstellungen (Schalter, Datum und Notiz).
export interface AnalyticsEnvLike {
  NEXT_PUBLIC_ANALYTICS_ENABLED: boolean
  APP_ENV: string
  PREVIEW_EXPORT: boolean
}

export interface AnalyticsSettingsLike {
  enabled?: boolean | null
  confirmedAt?: string | null
  note?: string | null
}

/** Vorbedingung ohne Datenbank: erst danach werden die Einstellungen gelesen. */
export const analyticsEnvAllows = (env: AnalyticsEnvLike): boolean =>
  env.NEXT_PUBLIC_ANALYTICS_ENABLED === true && env.APP_ENV === 'production' && !env.PREVIEW_EXPORT

export const analyticsSettingsAllow = (s: AnalyticsSettingsLike | null | undefined): boolean =>
  s?.enabled === true && Boolean(s.confirmedAt) && Boolean(String(s.note ?? '').trim())

export const analyticsAllowed = (
  env: AnalyticsEnvLike,
  s: AnalyticsSettingsLike | null | undefined,
) => analyticsEnvAllows(env) && analyticsSettingsAllow(s)
