import 'server-only'

import { normalizeLogPath } from '../routes/paths'
import { redact, redactText } from '../security/redact'

// Sentry-Konfiguration ohne SDK-Import (ARCHITEKTUR §11.4, R-133, R-137): das SDK wird nur in `instrumentation.ts`
// geladen. Hier liegen die Optionen und `redactSentryEvent()` – testbar ohne Netz.

export interface SentryEnvLike {
  SENTRY_DSN?: string | undefined
  SENTRY_ENVIRONMENT?: string | undefined
  APP_ENV: string
  VERCEL_GIT_COMMIT_SHA?: string | undefined
}

/** Fehler, die keine Störung sind (404/Weiterleitung von Next.js). */
export const SENTRY_IGNORE_ERRORS: (string | RegExp)[] = ['NEXT_NOT_FOUND', 'NEXT_REDIRECT']

/** Nur Server und nur mit gesetztem DSN (sonst keine Initialisierung, kein Netzwerkzugriff). */
export const sentryActive = (env: Pick<SentryEnvLike, 'SENTRY_DSN'>, runtime?: string): boolean =>
  runtime === 'nodejs' && Boolean(env.SENTRY_DSN)

type Json = Record<string, unknown>

/** Pfad ohne Query und mit normalisierten Token-Seiten. */
function safeUrl(url: string): string {
  try {
    const u = new URL(url)
    return normalizeLogPath(u.pathname)
  } catch {
    return normalizeLogPath(url)
  }
}

/** Entfernt Personendaten aus einem Sentry-Ereignis (Cookies, Daten, Header außer `user-agent`, Texte, Extras). */
export function redactSentryEvent<T extends object>(event: T): T {
  const e = event as unknown as Json
  const request = e.request as Json | undefined
  if (request) {
    delete request.cookies
    delete request.data
    delete request.query_string
    const headers = request.headers as Record<string, string> | undefined
    request.headers = headers?.['user-agent'] ? { 'user-agent': headers['user-agent'] } : {}
    if (typeof request.url === 'string') request.url = safeUrl(request.url)
  }
  delete e.user
  delete e.server_name
  if (typeof e.message === 'string') e.message = redactText(e.message)
  const logentry = e.logentry as Json | undefined
  if (logentry && typeof logentry.message === 'string')
    logentry.message = redactText(logentry.message)
  const exception = e.exception as { values?: Json[] } | undefined
  for (const v of exception?.values ?? []) {
    if (typeof v.value === 'string') v.value = redactText(v.value)
  }
  if (e.extra) e.extra = redact(e.extra)
  if (e.contexts) e.contexts = redact(e.contexts)
  if (e.tags) e.tags = redact(e.tags)
  const breadcrumbs = e.breadcrumbs as Json[] | { values?: Json[] } | undefined
  const list = Array.isArray(breadcrumbs) ? breadcrumbs : breadcrumbs?.values
  for (const b of list ?? []) redactSentryBreadcrumb(b)
  return event
}

/** Breadcrumbs: Texte schwärzen, Daten verwerfen bzw. schwärzen, URLs auf den Pfad kürzen. */
export function redactSentryBreadcrumb<T extends object>(crumb: T): T {
  const b = crumb as unknown as Json
  if (typeof b.message === 'string') b.message = redactText(b.message)
  if (b.data && typeof b.data === 'object') {
    const data = redact(b.data) as Json
    for (const k of ['url', 'to', 'from'] as const) {
      if (typeof data[k] === 'string') data[k] = safeUrl(data[k])
    }
    b.data = data
  }
  return crumb
}

/** Optionen für `Sentry.init` (ARCHITEKTUR §11.4). */
export function buildSentryOptions(env: SentryEnvLike) {
  return {
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT || env.APP_ENV,
    release: env.VERCEL_GIT_COMMIT_SHA,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    maxBreadcrumbs: 20,
    ignoreErrors: SENTRY_IGNORE_ERRORS,
    beforeSend: <E extends object>(event: E): E => redactSentryEvent(event),
    beforeBreadcrumb: <B extends object>(crumb: B): B => redactSentryBreadcrumb(crumb),
  }
}
