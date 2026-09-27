import 'server-only'

import { createLocalReq, getPayload, type Payload } from 'payload'

import { isAdminRequest } from '@/access'
import { getEnv, type Env } from '@/lib/env'
import { logger } from '@/lib/monitoring/logger'
import { systemClock } from '@/lib/time'

import { jobAlarm } from './alarm'
import { isCronAuthorized } from './auth'
import { TaskNotImplementedError, UnknownTaskError, runTaskNow } from './runTask'

// Route-Handler-Logik für `GET /api/cron/tick` und `POST /api/cron/run/[task]` (ARCHITEKTUR §2.5, §9.6).
// Gerüst aus P1.9: P5.3 ergänzt Lauf-Protokoll, Locks und die vollständige Weckzeit-Berechnung.

export interface CronDeps {
  env?: Env
  now?: Date
  /** Lädt Payload erst, wenn wirklich gearbeitet wird (der Tick ohne Fälliges öffnet keine DB-Verbindung). */
  loadPayload?: () => Promise<Payload>
}

async function defaultLoadPayload(): Promise<Payload> {
  const { default: config } = await import('@payload-config')
  return getPayload({ config })
}

const json = (body: unknown, status: number) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

const unauthorized = () => json({ error: 'unauthorized' }, 401)

/** Frühester Wartezeitpunkt offener Jobs; offene Jobs ohne Wartezeit sind sofort fällig. */
async function nextPendingJobAt(payload: Payload, now: Date): Promise<Date | null> {
  const res = await payload.find({
    collection: 'payload-jobs',
    where: {
      and: [{ completedAt: { exists: false } }, { hasError: { not_equals: true } }],
    },
    depth: 0,
    limit: 200,
    pagination: false,
    overrideAccess: true,
  })
  let min: number | null = null
  for (const doc of res.docs as { waitUntil?: string | null }[]) {
    const t = doc.waitUntil ? Date.parse(doc.waitUntil) : now.getTime()
    if (min === null || t < min) min = t
  }
  return min === null ? null : new Date(Math.max(min, now.getTime()))
}

export async function handleTick(request: Request, deps: CronDeps = {}): Promise<Response> {
  const env = deps.env ?? getEnv()
  if (!isCronAuthorized(request.headers, env)) return unauthorized()
  if (env.MAINTENANCE_MODE) return new Response(null, { status: 204 })
  const now = deps.now ?? systemClock.now()
  // Ohne Datenbank: nur die Systemdatei lesen.
  if (!(await jobAlarm.isDue(now))) return new Response(null, { status: 204 })

  const payload = await (deps.loadPayload ?? defaultLoadPayload)()
  const req = await createLocalReq({ context: { system: true, now: now.toISOString() } }, payload)
  const schedules = await payload.jobs.handleSchedules({ allQueues: true, req })
  const run = await payload.jobs.run({ allQueues: true, limit: 50, req })
  const next = await nextPendingJobAt(payload, now)
  await jobAlarm.markFullRun(now, next)
  const ran = Object.keys(run.jobStatus ?? {}).length
  logger.info('cron.tick', { ran, scheduled: schedules.queued.length })
  return json({ status: 'ran', ran, scheduled: schedules.queued.length }, 200)
}

export async function handleRunTask(
  request: Request,
  task: string,
  deps: CronDeps = {},
): Promise<Response> {
  const env = deps.env ?? getEnv()
  const load = deps.loadPayload ?? defaultLoadPayload
  let payload: Payload | undefined
  if (!isCronAuthorized(request.headers, env)) {
    // Rückfall: angemeldete Verwaltung (Admin-Sitzung).
    payload = await load()
    const { user } = await payload.auth({ headers: request.headers })
    if (!isAdminRequest({ user } as never)) return unauthorized()
  }
  try {
    payload ??= await load()
    const result = await runTaskNow(payload, task, { now: deps.now })
    return json({ status: 'ran', ...result }, 200)
  } catch (e) {
    if (e instanceof UnknownTaskError) return json({ error: e.message }, 404)
    if (e instanceof TaskNotImplementedError) return json({ error: e.message, phase: e.phase }, 409)
    throw e
  }
}
