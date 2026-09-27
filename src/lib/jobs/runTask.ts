import 'server-only'

import { createLocalReq, type Payload } from 'payload'

import { TASK_DEFS, isImplementedTask, isTaskSlug, type TaskSlug } from '@/jobs/index'

// Einen Task sofort ausführen (`pnpm jobs:run`, `POST /api/cron/run/[task]`, Admin „Jetzt ausführen“). Nur Slugs aus
// ARCHITEKTUR Anhang A.3; noch nicht umgesetzte Tasks werden mit Hinweis auf ihre Phase abgelehnt.

export class UnknownTaskError extends Error {
  constructor(slug: string) {
    super(`Unbekannter Task „${slug}“ – erlaubt sind nur die Slugs aus ARCHITEKTUR Anhang A.3.`)
    this.name = 'UnknownTaskError'
  }
}

export class TaskNotImplementedError extends Error {
  constructor(
    slug: string,
    readonly phase: string,
  ) {
    super(`Task „${slug}“ ist noch nicht umgesetzt (folgt in ${phase}).`)
    this.name = 'TaskNotImplementedError'
  }
}

export function assertRunnableTask(slug: string): TaskSlug {
  if (!isTaskSlug(slug)) throw new UnknownTaskError(slug)
  if (!isImplementedTask(slug)) throw new TaskNotImplementedError(slug, TASK_DEFS[slug].phase)
  return slug
}

export interface RunTaskResult {
  task: TaskSlug
  /** Anzahl ausgeführter Jobs. */
  ran: number
}

/**
 * Tasks mit Eingabe (z. B. `sendEmail`) arbeiten ihre wartenden Jobs ab; Tasks ohne Eingabe werden eingereiht und
 * sofort ausgeführt. `now` wird als `req.context.now` an die Tasks weitergegeben.
 */
export async function runTaskNow(
  payload: Payload,
  slug: string,
  options: { now?: Date; limit?: number } = {},
): Promise<RunTaskResult> {
  const task = assertRunnableTask(slug)
  const def = TASK_DEFS[task] as { queue: string; needsInput?: boolean }
  const req = await createLocalReq(
    { context: { system: true, ...(options.now ? { now: options.now.toISOString() } : {}) } },
    payload,
  )
  if (def.needsInput) {
    const res = await payload.jobs.run({
      queue: def.queue,
      where: { taskSlug: { equals: task } },
      limit: options.limit ?? 50,
      req,
    })
    return { task, ran: Object.keys(res.jobStatus ?? {}).length }
  }
  const job = await payload.jobs.queue({
    task: task as 'sendEmail',
    input: {} as never,
    queue: def.queue,
    req,
  })
  const res = await payload.jobs.runByID({ id: job.id, req })
  return { task, ran: Object.keys(res.jobStatus ?? {}).length }
}
