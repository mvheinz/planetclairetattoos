import 'server-only'

import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'

import { isAdminRequest } from '@/access'
import { JOB_QUEUE_OF, WAKE_TASK_NOT_BEFORE_HOUR, WAKE_TASK_SLUGS } from '@/jobs/index'
import { getEnv, type Env } from '@/lib/env'
import { logger } from '@/lib/monitoring/logger'
import { formatBerlin, systemClock } from '@/lib/time'

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

/** Fristen-Tasks einreihen, sofern nicht schon ein offener Job dafür wartet. */
async function queueWakeTasks(payload: Payload, req: PayloadRequest, now: Date): Promise<number> {
  let queued = 0
  const hour = Number(formatBerlin(now, 'H'))
  for (const task of WAKE_TASK_SLUGS) {
    const notBefore = WAKE_TASK_NOT_BEFORE_HOUR[task]
    if (notBefore !== undefined && hour < notBefore) continue
    const open = await payload.count({
      collection: 'payload-jobs',
      where: {
        and: [
          { taskSlug: { equals: task } },
          { completedAt: { exists: false } },
          { hasError: { not_equals: true } },
        ],
      },
      overrideAccess: true,
    })
    if (open.totalDocs > 0) continue
    await payload.jobs.queue({
      task: task as 'sendEmail',
      input: {} as never,
      queue: JOB_QUEUE_OF[task],
      req,
    })
    queued += 1
  }
  return queued
}

/** Weckzeit nach dem Lauf: offene Jobs und von Tasks gesetzte künftige Weckzeiten (`jobAlarm.bump`). */
async function nextWake(payload: Payload, now: Date): Promise<Date | null> {
  const pending = await nextPendingJobAt(payload, now)
  const state = await jobAlarm.read()
  const bumped = state.nextDueAt ? new Date(state.nextDueAt) : null
  const future = bumped && bumped.getTime() > now.getTime() ? bumped : null
  if (!pending) return future
  if (!future) return pending
  return pending.getTime() <= future.getTime() ? pending : future
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
  await queueWakeTasks(payload, req, now)
  const run = await payload.jobs.run({ allQueues: true, limit: 50, req })
  const next = await nextWake(payload, now)
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
