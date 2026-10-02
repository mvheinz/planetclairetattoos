import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import { createLocalReq, type Payload, type PayloadRequest } from 'payload'

import type { SqlExecutor } from '@/lib/db/tx'
import type { DeletionAction } from '@/lib/enums'
import { jobRunError, poolDb } from '@/lib/jobs/runLog'
import { createLogger } from '@/lib/monitoring/logger'
import { inTransaction } from '@/lib/payload/transaction'

import { writeDeletionLog } from './log'

// Gemeinsamer Runner der Löschjobs (LOESCHKONZEPT §4 „Regeln für alle Löschjobs“, DATENMODELL §11, PLAN P6.14):
// 1. idempotent – Kandidaten werden nach gespeicherten Zeitpunkten gewählt; was erledigt ist, fällt heraus;
// 2. höchstens `limit` (500) Datensätze je Lauf, der Rest im nächsten Lauf;
// 3. je Datensatz eine eigene Transaktion: erst Speicherobjekte, dann Datensatz; `deletion-log` in derselben
//    Transaktion (`trigger = job`, `taskSlug`); scheitert etwas, bleibt der Datensatz, der Fehlschlag wird in
//    `retention_failures` gezählt – nach 3 Fehlschlägen A12 (`admin_alert`);
// 4. Datensätze mit `privacy.legalHold` schließen die Kandidaten-Abfragen aus;
// 5. Trockenlauf (`dryRun`) für die Löschvorschau: nur Kandidaten bis `now + horizon`, nichts ändern;
// 6. Zeit nur aus der injizierten Uhr (`now`, SQL bekommt sie als Parameter, nie `now()`).

const log = createLogger()

/** Höchstzahl Datensätze je Lauf (LOESCHKONZEPT §4 Regel 1). */
export const RETENTION_BATCH_LIMIT = 500
/** Ab so vielen Fehlschlägen desselben Datensatzes geht A12 (LOESCHKONZEPT §4 Regel 2). */
export const RETENTION_ALERT_AFTER_FAILURES = 3

export interface RetentionCandidate {
  id: number | string
  /** Ab hier fällig (für die Löschvorschau). */
  dueAt: Date
}

export interface RetentionApplyResult {
  /** Anzahl gelöschter Speicherobjekte (Dateien). */
  storageObjectsCount?: number
  /** `false`: nichts mehr zu tun (z. B. schon gelöscht) – kein Protokolleintrag. */
  changed?: boolean
}

export interface RetentionStep {
  /** Regel-ID wie im `deletion-log`, z. B. `L-03`, `L-05 Stufe C`. */
  ruleId: string
  /** Collection des Protokolleintrags. */
  collection: string
  action: DeletionAction
  /** Fällige Kandidaten bis `until` (ohne Legal Hold), höchstens `limit`, ältester zuerst. */
  candidates(db: SqlExecutor, until: Date, limit: number): Promise<RetentionCandidate[]>
  /** Aktion in der Transaktion von `req`. */
  apply(req: PayloadRequest, id: number | string, now: Date): Promise<RetentionApplyResult | void>
}

export interface RetentionStepResult {
  ruleId: string
  collection: string
  action: DeletionAction
  /** Erledigt (bzw. im Trockenlauf: fällig). */
  count: number
  ids: (number | string)[]
  failed: number
}

export interface RetentionRunResult {
  task: string
  dryRun: boolean
  until: string
  processed: number
  failed: number
  steps: RetentionStepResult[]
}

export interface RetentionRunOptions {
  now: Date
  dryRun?: boolean
  /** Trockenlauf: Vorschau-Zeitraum in ms (Löschvorschau: 30 Tage). */
  horizonMs?: number
  limit?: number
  /** Kein Eintrag im `deletion-log` (nur `retentionDeletionLog`, L-18). */
  skipDeletionLog?: boolean
}

async function recordFailure(
  db: SqlExecutor,
  task: string,
  step: RetentionStep,
  id: number | string,
  error: string,
  now: Date,
): Promise<{ failures: number; alerted: boolean }> {
  const res = await db.execute(sql`
    INSERT INTO retention_failures (task, entity_collection, entity_id, failures, last_error, last_failed_at)
    VALUES (${task}, ${step.collection}, ${String(id)}, 1, ${error}, ${now.toISOString()}::timestamptz)
    ON CONFLICT (task, entity_collection, entity_id)
    DO UPDATE SET failures = retention_failures.failures + 1, last_error = EXCLUDED.last_error,
                  last_failed_at = EXCLUDED.last_failed_at
    RETURNING failures, alerted_at`)
  const row = res.rows[0] ?? {}
  return { failures: Number(row.failures ?? 1), alerted: row.alerted_at != null }
}

async function clearFailure(
  db: SqlExecutor,
  task: string,
  step: RetentionStep,
  id: number | string,
): Promise<void> {
  await db.execute(sql`
    DELETE FROM retention_failures
     WHERE task = ${task} AND entity_collection = ${step.collection} AND entity_id = ${String(id)}`)
}

async function alertFailure(
  payload: Payload,
  task: string,
  step: RetentionStep,
  id: number | string,
  failures: number,
  now: Date,
): Promise<void> {
  const { sendAdminAlert } = await import('@/lib/email/alerts')
  const req = await createLocalReq({ context: { system: true, now: now.toISOString() } }, payload)
  await sendAdminAlert(req, {
    kind: `retention_failed.${task.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()}`.slice(
      0,
      80,
    ),
    summary: `Löschfrist konnte nicht umgesetzt werden (${step.ruleId})`,
    affected: `${step.collection} Nr. ${id} – ${failures} Fehlversuche im Löschjob „${task}“.`,
    automatic: 'Der Datensatz bleibt stehen; der nächste Lauf versucht es erneut.',
    todo: 'Bitte unter Einstellungen → System das Lauf-Protokoll prüfen (z. B. Speicher nicht erreichbar).',
    adminPath: '/globals/settings',
    now,
  })
  await poolDb(payload).execute(sql`
    UPDATE retention_failures SET alerted_at = ${now.toISOString()}::timestamptz
     WHERE task = ${task} AND entity_collection = ${step.collection} AND entity_id = ${String(id)}`)
}

/** Führt die Schritte eines Löschjobs aus (bzw. listet sie im Trockenlauf). */
export async function runRetentionSteps(
  payload: Payload,
  task: string,
  steps: readonly RetentionStep[],
  options: RetentionRunOptions,
): Promise<RetentionRunResult> {
  const { now, dryRun = false } = options
  const until = new Date(now.getTime() + (dryRun ? (options.horizonMs ?? 0) : 0))
  let remaining = options.limit ?? RETENTION_BATCH_LIMIT
  const db = poolDb(payload)
  const result: RetentionRunResult = {
    task,
    dryRun,
    until: until.toISOString(),
    processed: 0,
    failed: 0,
    steps: [],
  }
  for (const step of steps) {
    const out: RetentionStepResult = {
      ruleId: step.ruleId,
      collection: step.collection,
      action: step.action,
      count: 0,
      ids: [],
      failed: 0,
    }
    result.steps.push(out)
    if (remaining <= 0) continue
    const candidates = await step.candidates(db, until, remaining)
    if (dryRun) {
      out.count = candidates.length
      out.ids = candidates.map((c) => c.id)
      remaining -= candidates.length
      continue
    }
    for (const c of candidates) {
      remaining -= 1
      try {
        const req = await createLocalReq(
          { context: { system: true, skipAudit: true, now: now.toISOString() } },
          payload,
        )
        const done = await inTransaction(req, async () => {
          const applied = (await step.apply(req, c.id, now)) ?? {}
          if (applied.changed === false) return false
          if (!options.skipDeletionLog) {
            await writeDeletionLog(req, {
              entityCollection: step.collection,
              entityId: c.id,
              ruleId: step.ruleId,
              action: step.action,
              trigger: 'job',
              taskSlug: task,
              storageObjectsCount: applied.storageObjectsCount ?? 0,
              executedAt: now,
            })
          }
          return true
        })
        await clearFailure(db, task, step, c.id)
        if (done) {
          out.count += 1
          out.ids.push(c.id)
        }
      } catch (e) {
        const error = jobRunError(e)
        out.failed += 1
        log.warn('retention.step_failed', { task, rule: step.ruleId, id: String(c.id), error })
        const f = await recordFailure(db, task, step, c.id, error, now)
        if (f.failures >= RETENTION_ALERT_AFTER_FAILURES && !f.alerted) {
          await alertFailure(payload, task, step, c.id, f.failures, now).catch((err: unknown) =>
            log.error('retention.alert_failed', { task, error: jobRunError(err) }),
          )
        }
      }
    }
    result.processed += out.count
    result.failed += out.failed
  }
  return result
}

/** Zähler für `job_runs.counts` (nur Zahlen, keine IDs mit Personenbezug). */
export function retentionCounts(result: RetentionRunResult): Record<string, number> {
  const counts: Record<string, number> = { processed: result.processed, failed: result.failed }
  for (const s of result.steps) {
    const key = `${s.ruleId}:${s.collection}`.replace(/[^A-Za-z0-9:_-]/g, '_')
    counts[key] = (counts[key] ?? 0) + s.count
  }
  return counts
}
