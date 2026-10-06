import type { captureRequestError } from '@sentry/nextjs'

// Start-Prüfung der Umgebung beim Serverstart (ARCHITEKTUR §4.2/§4.3) und Fehlerüberwachung (§11.4, R-133): Sentry
// (`@sentry/nextjs`, nur Server) wird **nur hier** geladen und nur bei `NEXT_RUNTIME === 'nodejs'` mit gesetztem
// `SENTRY_DSN` initialisiert. Ohne DSN bleibt das SDK ungeladen: keine Initialisierung, kein Netzwerkzugriff.

let sentryLoaded = false

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  // AK-A-4-02: Nur hier ist die Erkennung über NODE_ENV erlaubt – ein Produktions-Start ohne APP_ENV bricht ab.
  if (
    process.env.NODE_ENV === 'production' &&
    !process.env.APP_ENV &&
    process.env.NEXT_PHASE !== 'phase-production-build'
  ) {
    throw new Error(
      'Start abgebrochen – APP_ENV fehlt (Produktions-Build ohne APP_ENV, ARCHITEKTUR §4.2).',
    )
  }
  const { assertProductionEnv, getEnv } = await import('./lib/env')
  const env = getEnv()
  assertProductionEnv(env)
  const { sentryActive, buildSentryOptions } = await import('./lib/monitoring/sentry')
  if (!sentryActive(env, process.env.NEXT_RUNTIME)) return
  const Sentry = await import('@sentry/nextjs')
  Sentry.init(buildSentryOptions(env))
  const { setErrorReporter } = await import('./lib/monitoring/errorReporter')
  setErrorReporter((event, fields) => {
    Sentry.withScope((scope) => {
      scope.setTag('event', event)
      scope.setExtras(fields)
      Sentry.captureException(new Error(event))
    })
  })
  sentryLoaded = true
}

/** `Sentry.captureRequestError` (M-01); ohne Initialisierung ein No-op. */
export const onRequestError: typeof captureRequestError = async (...args) => {
  if (!sentryLoaded) return
  const Sentry = await import('@sentry/nextjs')
  return Sentry.captureRequestError(...args)
}
