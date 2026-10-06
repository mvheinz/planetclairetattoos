import 'server-only'

import type { Payload } from 'payload'
import { z } from 'zod'

import type { Env } from '@/lib/env'
import { ipHash } from '@/lib/security/ipHash'
import { clientIp, hit } from '@/lib/security/rateLimit'
import { redactText } from '@/lib/security/redact'
import { normalizeLogPath } from '@/lib/routes/paths'

import { reportError } from './errorReporter'

// `POST /api/client-errors` (ARCHITEKTUR §2.5, §8.5, M-02, R-133, R-137): Browserfehler öffentlicher Seiten, **standardmäßig
// aus** bis Kanzleifrage K-30 (c). Aktiv nur mit `NEXT_PUBLIC_CLIENT_ERRORS_ENABLED=true` und `APP_ENV=production`, sonst 404
// ohne Verarbeitung. Aktiv: Rate-Limit `client_errors` (IP-Hash, darüber stilles Verwerfen mit 204), nur first-party, keine
// Cookies, keine IP-Speicherung (nur der gehashte Schlüssel des Zählers), alles geschwärzt, Weitergabe serverseitig an Sentry.

export const CLIENT_ERROR_MAX_BYTES = 4096

export const clientErrorsActive = (
  env: Pick<Env, 'NEXT_PUBLIC_CLIENT_ERRORS_ENABLED' | 'APP_ENV'>,
): boolean => env.NEXT_PUBLIC_CLIENT_ERRORS_ENABLED === true && env.APP_ENV === 'production'

const Body = z.object({
  message: z.string().max(500),
  stack: z.string().max(2000).optional(),
  path: z.string().max(300).optional(),
})

const empty = (status: number) =>
  new Response(null, { status, headers: { 'cache-control': 'no-store' } })

export async function handleClientError(
  request: Request,
  deps: {
    env: Pick<Env, 'NEXT_PUBLIC_CLIENT_ERRORS_ENABLED' | 'APP_ENV'>
    payload: () => Promise<Payload>
    now: Date
  },
): Promise<Response> {
  if (!clientErrorsActive(deps.env)) return new Response(null, { status: 404 })
  const raw = await request.text()
  if (raw.length > CLIENT_ERROR_MAX_BYTES) return empty(413)
  let parsed
  try {
    parsed = Body.safeParse(JSON.parse(raw))
  } catch {
    return empty(400)
  }
  if (!parsed.success) return empty(400)
  const ip = clientIp(request.headers) ?? 'unknown'
  const limit = await hit(
    'client_errors',
    ipHash(ip, { now: () => deps.now }),
    deps.now,
    await deps.payload(),
  )
  if (!limit.allowed) return empty(204) // stilles Verwerfen
  const { message, stack, path } = parsed.data
  reportError('client.error', {
    source: 'browser',
    message: redactText(message),
    ...(stack ? { stack: redactText(stack) } : {}),
    ...(path ? { path: normalizeLogPath(path) } : {}),
  })
  return empty(204)
}
