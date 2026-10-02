import 'server-only'

import { createLocalReq, type TaskConfig, type TaskHandler } from 'payload'

import { logger } from '@/lib/monitoring/logger'

import { jobAlarm } from './alarm'
import { jobNow } from './now'
import { countsFromOutput, insertJobRun, jobRunError, poolDb } from './runLog'

// Jeder Task-Lauf schreibt genau einen Eintrag in `job_runs` (DATENMODELL §11, KONZEPT §8.1 Nr. 4) – auch bei
// „Jetzt ausführen“. Ausgabe `skipped: true` (Lock belegt bzw. nichts fällig) → Status `skipped`. Ein Fehlschlag eines
// Tasks der Queues `commerce` oder `documents` (geldrelevant) meldet A12 über `notifyAdmin` (Fehlerart
// `job_failed.<task_snake>`, höchstens eine Mail je Stunde); der Fehler wird danach weitergeworfen (Payload-Retries).

/** Queues, deren Fehlschläge A12 auslösen (PLAN P5.3, KONZEPT §8.1 Nr. 4). */
export const ALERT_QUEUES: ReadonlySet<string> = new Set(['commerce', 'documents'])

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTask = TaskConfig<any>

export function instrumentTask<T extends AnyTask>(task: T, queue: string): T {
  const inner = task.handler
  if (typeof inner !== 'function') return task
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handler: TaskHandler<any> = async (args) => {
    const startedAt = jobNow(args.req)
    const db = poolDb(args.req.payload)
    try {
      const result = await inner(args)
      const output = (result as { output?: Record<string, unknown> } | undefined)?.output
      await insertJobRun(db, {
        task: task.slug,
        startedAt,
        finishedAt: jobNow(args.req),
        status: output?.skipped === true ? 'skipped' : 'ok',
        counts: countsFromOutput(output),
      }).catch((e: unknown) =>
        logger.error('job_runs.insert_failed', { task: task.slug, reason: jobRunError(e) }),
      )
      return result
    } catch (err) {
      const error = jobRunError(err)
      await insertJobRun(db, {
        task: task.slug,
        startedAt,
        finishedAt: jobNow(args.req),
        status: 'failed',
        error,
      }).catch((e: unknown) =>
        logger.error('job_runs.insert_failed', { task: task.slug, reason: jobRunError(e) }),
      )
      if (ALERT_QUEUES.has(queue)) await alertTaskFailure(args.req.payload, task.slug, startedAt)
      throw err
    }
  }
  return { ...task, handler } as T
}

/** Fehlerart der A12 je Task (`job_failed.<task_in_snake_case>`, KIND_RE in `alerts.ts`). */
export const jobFailedKind = (slug: string) =>
  `job_failed.${slug.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()}`.slice(0, 80)

async function alertTaskFailure(
  payload: Parameters<typeof createLocalReq>[1],
  slug: string,
  now: Date,
): Promise<void> {
  try {
    const { notifyAdmin } = await import('@/lib/email/notifyAdmin')
    const req = await createLocalReq({ context: { system: true, now: now.toISOString() } }, payload)
    const res = await notifyAdmin(
      req,
      'admin_alert',
      {
        kind: jobFailedKind(slug),
        summary: `Automatische Aufgabe „${slug}“ ist fehlgeschlagen`,
        automatic: 'Die Aufgabe wird automatisch erneut versucht.',
        todo: 'Wenn diese Meldung wiederkommt, bitte unter Einstellungen → System das Lauf-Protokoll prüfen.',
        adminPath: '/globals/settings',
      },
      { now },
    )
    if (res.jobId !== null) await jobAlarm.bump(now)
  } catch (e) {
    logger.error('job.alert_failed', { task: slug, reason: jobRunError(e) })
  }
}
