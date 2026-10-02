import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import { createLocalReq, type Payload, type PayloadRequest } from 'payload'

import { dbFor, type SqlExecutor } from '@/lib/db/tx'
import type { DeletionAction } from '@/lib/enums'
import { jobRunError, poolDb } from '@/lib/jobs/runLog'
import { createLogger } from '@/lib/monitoring/logger'
import { preservingReq } from '@/lib/payload/localReq'
import { inTransaction } from '@/lib/payload/transaction'

import {
  anonymizeOrder,
  deletePrivateUpload,
  RETENTION_TASK_SLUGS,
  RETENTION_TASK_STEPS,
  runRetentionTask,
} from './jobs'
import type { RetentionStep } from './runner'

// `retention:replay` (LOESCHKONZEPT §3.6, ARCHITEKTUR §6.10/§10.5, DATENMODELL §6.27, PLAN P6.15): nach einer
// Wiederherstellung alle Einträge des Löschprotokolls in Reihenfolge `executedAt` erneut auf noch vorhandene IDs
// anwenden (gelöscht → löschen, anonymisiert → anonymisieren, eingeschränkt → einschränken, Dateien → Dateien löschen)
// und danach jeden Löschjob einmal ausführen. Idempotent: ein zweiter Lauf findet nichts mehr. Das Wiederanwenden
// schreibt keine neuen Protokolleinträge (die Einträge stehen schon im Protokoll).

const log = createLogger()
const PAGE = 500

export interface ReplayEntry {
  id: number
  entityCollection: string
  entityId: string
  ruleId: string
  action: DeletionAction
}

export interface ReplayResult {
  entries: number
  reapplied: number
  failed: number
  /** Vom anschließenden Lauf aller Löschjobs erledigt (je Task). */
  jobs: Record<string, number>
}

/** Tabellen ohne Einzel-IDs (L-13 a/g): erledigt der anschließende Lauf von `retentionTechnical`. */
const BULK = new Set(['rate-limit-hits', 'job-runs'])

const STEP_INDEX = new Map<string, RetentionStep>()
for (const steps of Object.values(RETENTION_TASK_STEPS)) {
  for (const s of steps as readonly RetentionStep[])
    STEP_INDEX.set(`${s.ruleId}|${s.collection}`, s)
}

const tableOf = (collection: string) => collection.replace(/-/g, '_')

async function row(db: SqlExecutor, collection: string, id: string) {
  if (!/^\d+$/.test(id)) return null
  const reg = await db.execute(sql`SELECT to_regclass(${tableOf(collection)}) AS t`)
  if (!reg.rows[0]?.t) return null
  const res = await db.execute(
    sql`SELECT * FROM ${sql.raw(`"${tableOf(collection)}"`)} WHERE id = ${Number(id)}`,
  )
  return res.rows[0] ?? null
}

/** Ist am vorhandenen Datensatz noch etwas zu tun? */
function needsReapply(entry: ReplayEntry, current: Record<string, unknown>): boolean {
  if (entry.action === 'deleted') return true
  if (entry.action === 'restricted') return current.privacy_processing_restricted !== true
  if (entry.action === 'files_deleted') return current.restricted !== true
  // anonymized
  if (entry.entityCollection === 'invoices') return current.anonymized_at == null
  if (entry.entityCollection !== 'orders') return false
  if (entry.ruleId === 'L-05 Stufe B') {
    return current.status_token_hash != null || current.status_token_sealed != null
  }
  if (entry.ruleId === 'L-04 Stufe 1') {
    return (
      current.shipping_address_name != null ||
      current.shipping_address_address_line1 != null ||
      current.billing_address_name != null ||
      current.billing_address_address_line1 != null ||
      current.carrier_email_consent === true
    )
  }
  return current.privacy_anonymized_at == null
}

async function reapply(req: PayloadRequest, entry: ReplayEntry, now: Date): Promise<void> {
  const id = Number(entry.entityId)
  const step = STEP_INDEX.get(`${entry.ruleId}|${entry.entityCollection}`)
  if (step) {
    await step.apply(req, id, now)
    return
  }
  const db = await dbFor(req)
  // Aktionen aus DSGVO-Anfragen bzw. „Jetzt löschen“ (ruleId `DSGVO`/`ADMIN`) oder Regeln ohne eigenen Schritt
  if (entry.action === 'anonymized' && entry.entityCollection === 'orders') {
    await anonymizeOrder(req, id, now, 'retentionReplay')
    return
  }
  if (entry.action === 'restricted') {
    await db.execute(sql`
      UPDATE ${sql.raw(`"${tableOf(entry.entityCollection)}"`)}
         SET privacy_processing_restricted = true, privacy_restricted_at = ${now.toISOString()}::timestamptz
       WHERE id = ${id}`)
    return
  }
  if (entry.action !== 'deleted') return
  if (entry.entityCollection === 'private-uploads') {
    await deletePrivateUpload(req, id)
    return
  }
  if (entry.entityCollection === 'orders') {
    // Bestellungen werden nie gelöscht, nur anonymisiert (L-04/L-05)
    await anonymizeOrder(req, id, now, 'retentionReplay')
    return
  }
  const slug = entry.entityCollection as 'users'
  if (req.payload.collections[slug]) {
    await preservingReq(req, () =>
      req.payload.delete({ collection: slug, id, overrideAccess: true, req }),
    )
  } else {
    await db.execute(
      sql`DELETE FROM ${sql.raw(`"${tableOf(entry.entityCollection)}"`)} WHERE id = ${id}`,
    )
  }
}

/** Alle Einträge des Löschprotokolls in Reihenfolge `executedAt` (seitenweise). */
async function* entries(db: SqlExecutor): AsyncGenerator<ReplayEntry> {
  let lastAt = '-infinity'
  let lastId = 0
  for (;;) {
    const res = await db.execute(sql`
      SELECT id, entity_collection, entity_id, rule_id, action, executed_at FROM deletion_log
       WHERE (executed_at, id) > (${lastAt}::timestamptz, ${lastId})
       ORDER BY executed_at, id LIMIT ${PAGE}`)
    if (res.rows.length === 0) return
    for (const r of res.rows) {
      yield {
        id: Number(r.id),
        entityCollection: String(r.entity_collection),
        entityId: String(r.entity_id),
        ruleId: String(r.rule_id),
        action: r.action as DeletionAction,
      }
    }
    const last = res.rows[res.rows.length - 1]!
    lastAt = new Date(last.executed_at as string).toISOString()
    lastId = Number(last.id)
  }
}

export async function replayDeletionLog(
  payload: Payload,
  options: { now: Date },
): Promise<ReplayResult> {
  const { now } = options
  const db = poolDb(payload)
  const result: ReplayResult = { entries: 0, reapplied: 0, failed: 0, jobs: {} }
  const seen = new Set<string>()
  for await (const entry of entries(db)) {
    result.entries += 1
    if (BULK.has(entry.entityCollection)) continue
    const key = `${entry.entityCollection}:${entry.entityId}:${entry.ruleId}:${entry.action}`
    if (seen.has(key)) continue
    seen.add(key)
    const current = await row(db, entry.entityCollection, entry.entityId)
    if (!current || !needsReapply(entry, current)) continue
    try {
      const req = await createLocalReq(
        { context: { system: true, skipAudit: true, now: now.toISOString() } },
        payload,
      )
      await inTransaction(req, () => reapply(req, entry, now))
      result.reapplied += 1
    } catch (e) {
      result.failed += 1
      log.error('retention.replay_failed', {
        collection: entry.entityCollection,
        id: entry.entityId,
        rule: entry.ruleId,
        error: jobRunError(e),
      })
    }
  }
  for (const task of RETENTION_TASK_SLUGS) {
    const res = await runRetentionTask(payload, task, { now })
    result.jobs[task] = res.processed
  }
  return result
}
