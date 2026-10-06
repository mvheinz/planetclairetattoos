import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

import { getEnv, type Env } from '@/lib/env'
import { isCronAuthorized } from '@/lib/jobs/auth'
import { readJson } from '@/lib/storage/systemFiles'

// `GET /api/health?deep=1` (ARCHITEKTUR §2.5, §10.5 Schritt 8): zusätzlich Datenbank- und Speicher-Ping, nur mit Bearer
// `CRON_SECRET`. Antwort ohne Details: `{ status, db, storage }` mit `ok | error`; 503, sobald ein Teil fehlschlägt.

export interface DeepHealthDeps {
  env?: Env
  payload?: () => Promise<Payload>
  /** Speicher-Ping (Tests); Standard: Systemdatei lesen (fehlende Datei ist in Ordnung). */
  storagePing?: () => Promise<void>
}

const NO_STORE = { 'cache-control': 'no-store' } as const

async function defaultPayload(): Promise<Payload> {
  const { default: config } = await import('@payload-config')
  const { getPayload } = await import('payload')
  return getPayload({ config })
}

export async function handleDeepHealth(
  request: Request,
  base: { version: string; appEnv: string },
  deps: DeepHealthDeps = {},
): Promise<Response> {
  const env = deps.env ?? getEnv()
  if (!isCronAuthorized(request.headers, env)) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE })
  }
  let db: 'ok' | 'error' = 'ok'
  let storage: 'ok' | 'error' = 'ok'
  try {
    const payload = await (deps.payload ?? defaultPayload)()
    const drizzle = (
      payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<unknown> } }
    ).drizzle
    await drizzle.execute(sql`SELECT 1`)
  } catch {
    db = 'error'
  }
  try {
    await (deps.storagePing ?? (async () => void (await readJson('job-alarm.json'))))()
  } catch {
    storage = 'error'
  }
  const ok = db === 'ok' && storage === 'ok'
  return Response.json(
    { status: ok ? 'ok' : 'error', db, storage, ...base },
    { status: ok ? 200 : 503, headers: NO_STORE },
  )
}
