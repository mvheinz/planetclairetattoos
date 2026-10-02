import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

import type { SqlExecutor } from '@/lib/db/tx'
import { redactText } from '@/lib/security/redact'

// Lauf-Protokoll `job_runs` (DATENMODELL §11, KONZEPT §8.1 Nr. 4; Migration `p5_job_runs`): eigene SQL-Tabelle, ein
// Eintrag je Task-Lauf (auch „Jetzt ausführen“), Zeitwerte aus `$now`. `counts` enthält nur Zähler, IDs und den
// Zeitraum-Schlüssel (`period`, für `runOncePer`), keine Inhalte; Fehlertexte über den Schwärzer (R-137), ≤ 1000 Zeichen.
// Geschrieben wird über den Pool (eigene Verbindung, Autocommit) – ein Fehlschlag des Tasks rollt den Eintrag nicht
// mit zurück.

export const JOB_RUN_STATUSES = ['ok', 'failed', 'skipped'] as const
export type JobRunStatus = (typeof JOB_RUN_STATUSES)[number]

/** Aufbewahrung laut L-13 g (Löschung durch `retentionTechnical`, P6.15). */
export const JOB_RUN_RETENTION_DAYS = 90
export const JOB_RUN_ERROR_MAX = 1000

export type JobRunCounts = Record<string, number | string | boolean | null | number[]>

export interface JobRunEntry {
  task: string
  startedAt: Date
  finishedAt: Date | null
  status: JobRunStatus
  counts?: JobRunCounts | null
  error?: string | null
}

export function poolDb(payload: Payload): SqlExecutor {
  return (payload.db as unknown as { drizzle: SqlExecutor }).drizzle
}

/** Nur Zähler, IDs, Wahrheitswerte und kurze Schlüssel aus einer Task-Ausgabe übernehmen (keine Inhalte). */
export function countsFromOutput(output: unknown): JobRunCounts | null {
  if (!output || typeof output !== 'object') return null
  const out: JobRunCounts = {}
  for (const [k, v] of Object.entries(output as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
    else if (typeof v === 'boolean') out[k] = v
    else if (typeof v === 'string' && /^[\w:.-]{1,40}$/.test(v)) out[k] = v
    else if (Array.isArray(v) && v.length <= 200 && v.every((x) => Number.isInteger(x)))
      out[k] = v as number[]
  }
  return Object.keys(out).length > 0 ? out : null
}

export function jobRunError(err: unknown): string {
  const raw = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
  return redactText(raw).slice(0, JOB_RUN_ERROR_MAX)
}

export async function insertJobRun(db: SqlExecutor, entry: JobRunEntry): Promise<number> {
  const counts = entry.counts ? JSON.stringify(entry.counts) : null
  const error = entry.error ? redactText(entry.error).slice(0, JOB_RUN_ERROR_MAX) : null
  const res = await db.execute(sql`
    INSERT INTO job_runs (task, started_at, finished_at, status, counts, error)
    VALUES (${entry.task}, ${entry.startedAt.toISOString()}::timestamptz,
      ${entry.finishedAt ? entry.finishedAt.toISOString() : null}::timestamptz,
      ${entry.status}, ${counts}::jsonb, ${error})
    RETURNING id`)
  return Number(res.rows[0]?.id)
}

export interface JobRunRow {
  id: number
  task: string
  startedAt: Date
  finishedAt: Date | null
  status: JobRunStatus
  counts: JobRunCounts | null
  error: string | null
}

export async function listJobRuns(
  db: SqlExecutor,
  options: { task?: string; since?: Date; limit?: number } = {},
): Promise<JobRunRow[]> {
  const res = await db.execute(sql`
    SELECT id, task, started_at, finished_at, status, counts, error FROM job_runs
    WHERE (${options.task ?? null}::text IS NULL OR task = ${options.task ?? null})
      AND (${options.since?.toISOString() ?? null}::timestamptz IS NULL
        OR started_at >= ${options.since?.toISOString() ?? null}::timestamptz)
    ORDER BY started_at DESC, id DESC
    LIMIT ${options.limit ?? 100}`)
  return res.rows.map((r) => ({
    id: Number(r.id),
    task: String(r.task),
    startedAt: new Date(String(r.started_at)),
    finishedAt: r.finished_at ? new Date(String(r.finished_at)) : null,
    status: r.status as JobRunStatus,
    counts: (r.counts as JobRunCounts | null) ?? null,
    error: (r.error as string | null) ?? null,
  }))
}

/** Gab es für `task` schon einen erfolgreichen Lauf im Zeitraum `period` (siehe `runOncePer`)? */
export async function hasOkRunForPeriod(
  db: SqlExecutor,
  task: string,
  period: string,
): Promise<boolean> {
  const res = await db.execute(sql`
    SELECT 1 FROM job_runs
    WHERE task = ${task} AND status = 'ok' AND counts->>'period' = ${period}
    LIMIT 1`)
  return res.rows.length > 0
}

/** L-13 g: Einträge älter als 90 Tage löschen (aufgerufen von `retentionTechnical`, P6.15). */
export async function deleteOldJobRuns(db: SqlExecutor, now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - JOB_RUN_RETENTION_DAYS * 24 * 60 * 60 * 1000)
  const res = await db.execute(sql`
    DELETE FROM job_runs WHERE started_at < ${cutoff.toISOString()}::timestamptz RETURNING id`)
  return res.rows.length
}
