import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import { createLocalReq, type Payload, type PayloadRequest } from 'payload'

import { TASK_DEFS } from '@/jobs/index'
import { dbFor } from '@/lib/db/tx'
import { enqueueEmail, runEmailJobNow } from '@/lib/email/outbox'
import { seedPreviewModeActive } from '@/lib/env'
import { jobAlarm } from '@/lib/jobs/alarm'
import { createLogger } from '@/lib/monitoring/logger'
import { getAppContext, requestNow } from '@/lib/payload/context'
import { preservingReq } from '@/lib/payload/localReq'
import { inTransaction } from '@/lib/payload/transaction'
import { berlinMonthRange, berlinYear } from '@/lib/time'
import type { RevenueSource } from '@/lib/enums'

import {
  computeRevenueStatus,
  parseLastNotified,
  thresholdsFromSettings,
  withNotified,
  type InvoiceMonthSum,
  type ManualYearTotal,
  type RevenueEntrySum,
  type RevenueStatus,
} from './guard'

// Umsatz-Wächter laden und melden (KONZEPT §8.4, R-125, PLAN P5.23): Summen per SQL (Belegdatum bzw. Monat in
// Europe/Berlin), Stufen per `computeRevenueStatus`, je neuer Stufe genau eine A09 (`admin_revenue_guard`,
// Idempotenz-Schlüssel `admin_revenue_guard:{Jahr}:{Stufe}`) und `settings.revenueGuard.lastNotified` in derselben
// Transaktion. Der Task `revenueGuardCheck` ruft `runRevenueGuardCheck` auf (täglich ab 07:00 mit dem Job-Wecker und
// nach jeder Beleg- oder Monatssummen-Änderung, `queueRevenueGuardCheck`).

const log = createLogger()

type Row = Record<string, unknown>
type SqlExecutor = { execute(q: ReturnType<typeof sql>): Promise<{ rows: Row[] }> }
const sqlOf = (payload: Payload) => (payload.db as unknown as { drizzle: SqlExecutor }).drizzle

export interface RevenueLoadOptions {
  /** Beispieldaten mitzählen – Standard `seedPreviewModeActive()` (in Produktion nie). */
  includeSeed?: boolean
}

async function loadSettings(payload: Payload): Promise<Row> {
  return (await payload.findGlobal({
    slug: 'settings',
    depth: 0,
    overrideAccess: true,
  })) as unknown as Row
}

/** Stand des Umsatz-Wächters für `year` (Standard: laufendes Berliner Jahr). */
export async function getRevenueStatus(
  payload: Payload,
  now: Date,
  options: RevenueLoadOptions & { year?: number; settings?: Row } = {},
): Promise<RevenueStatus> {
  const year = options.year ?? berlinYear(now)
  const from = berlinMonthRange(`${year - 1}-01`).start.toISOString()
  const to = berlinMonthRange(`${year + 1}-01`).start.toISOString()
  const db = sqlOf(payload)
  const inv = await db.execute(sql`
    SELECT to_char(issue_date AT TIME ZONE 'Europe/Berlin', 'YYYY-MM') AS month, type::text AS type,
           COALESCE(seed, false) AS seed, SUM(total_gross_cents)::bigint AS cents
      FROM invoices
     WHERE issue_date >= ${from}::timestamptz AND issue_date < ${to}::timestamptz
     GROUP BY 1, 2, 3
  `)
  const ent = await db.execute(sql`
    SELECT month, source::text AS source, COALESCE(seed, false) AS seed, SUM(amount_cents)::bigint AS cents
      FROM revenue_entries
     WHERE month >= ${`${year - 1}-01`} AND month <= ${`${year}-12`}
     GROUP BY 1, 2, 3
  `)
  const settings = options.settings ?? (await loadSettings(payload))
  const guard = (settings.revenueGuard ?? {}) as Row
  const manual = (Array.isArray(guard.manualYearTotals) ? guard.manualYearTotals : []) as Row[]
  return computeRevenueStatus({
    year,
    now,
    invoices: inv.rows.map((r): InvoiceMonthSum => ({
      month: String(r.month),
      type: r.type === 'credit_note' ? 'credit_note' : 'invoice',
      seed: r.seed === true,
      grossCents: Number(r.cents),
    })),
    entries: ent.rows.map((r): RevenueEntrySum => ({
      month: String(r.month),
      source: String(r.source) as RevenueSource,
      seed: r.seed === true,
      amountCents: Number(r.cents),
    })),
    manualYearTotals: manual.map((t): ManualYearTotal => ({
      year: Number(t.year),
      amountCents: Number(t.amountCents),
    })),
    thresholds: thresholdsFromSettings(guard as Parameters<typeof thresholdsFromSettings>[0]),
    includeSeed: options.includeSeed ?? seedPreviewModeActive(),
    lastNotified: parseLastNotified(guard.lastNotified),
  })
}

export interface RevenueGuardRunResult {
  year: number
  totalCents: number
  /** In diesem Lauf gemeldete Stufen (je eine A09). */
  notified: string[]
}

/** Stufen prüfen und neue Stufen genau einmal je Jahr melden (A09). */
export async function runRevenueGuardCheck(
  payload: Payload,
  now: Date,
  options: RevenueLoadOptions = {},
): Promise<RevenueGuardRunResult> {
  const at = now.toISOString()
  const req = await createLocalReq({ context: { system: true, now: at } }, payload)
  const tx = await inTransaction(req, async () => {
    const db = await dbFor(req)
    // Sperrt die Einstellungszeile: parallele Läufe melden dieselbe Stufe nicht doppelt.
    await db.execute(sql`SELECT pg_advisory_xact_lock(hashtext('revenue-guard'))`)
    const settings = (await preservingReq(req, () =>
      req.payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true, req }),
    )) as unknown as Row
    const status = await getRevenueStatus(payload, now, { ...options, settings })
    if (status.pending.length === 0) return { status, jobs: [] as (number | string | null)[] }
    const jobs: (number | string | null)[] = []
    for (const s of status.pending) {
      const mail = await enqueueEmail(req, {
        template: 'admin_revenue_guard',
        locale: 'de',
        data: {
          year: status.year,
          stage: s.stage,
          totalCents: status.totalCents,
          previousYearTotalCents: status.previousYearTotalCents,
          thresholds: status.thresholds,
        },
        idempotencyKey: `admin_revenue_guard:${status.year}:${s.stage}`,
      })
      jobs.push(mail.jobId)
    }
    const last = withNotified(
      parseLastNotified(((settings.revenueGuard ?? {}) as Row).lastNotified),
      status.year,
      status.pending.map((s) => s.stage),
    )
    // Direkt in der Zeile: ein Speichern über die Global-API würde alle Einstellungen erneut prüfen und auditieren.
    const res = await db.execute(
      sql`UPDATE settings SET revenue_guard_last_notified = ${JSON.stringify(last)}::jsonb`,
    )
    if ((res as unknown as { rowCount?: number }).rowCount === 0) {
      await preservingReq(req, () =>
        req.payload.updateGlobal({
          slug: 'settings',
          data: { revenueGuard: { lastNotified: last } } as never,
          depth: 0,
          overrideAccess: true,
          req,
          context: { ...req.context, system: true, skipAudit: true },
        }),
      )
    }
    return { status, jobs }
  })
  for (const job of tx.jobs) {
    await runEmailJobNow(payload, job, { now }).catch((e: unknown) =>
      log.error('revenue_guard.mail_failed', { error: (e as Error)?.message }),
    )
  }
  if (tx.jobs.length > 0) {
    log.info('revenue_guard.notified', {
      year: tx.status.year,
      stages: tx.status.pending.map((s) => s.stage).join(','),
    })
  }
  return {
    year: tx.status.year,
    totalCents: tx.status.totalCents,
    notified: tx.status.pending.map((s) => s.stage),
  }
}

/**
 * Nach einer Beleg- oder Monatssummen-Änderung: `revenueGuardCheck` einreihen (höchstens ein offener Job) und den
 * Job-Wecker wecken. Im Seed-Kontext nichts tun (der Seed ruft den Wächter nicht auf).
 */
export async function queueRevenueGuardCheck(req: PayloadRequest): Promise<void> {
  if (getAppContext(req).seed) return
  if (!req.payload.config.jobs.tasks?.some((t) => t.slug === 'revenueGuardCheck')) return
  const open = await preservingReq(req, () =>
    req.payload.count({
      collection: 'payload-jobs',
      where: {
        and: [
          { taskSlug: { equals: 'revenueGuardCheck' } },
          { completedAt: { exists: false } },
          { processing: { not_equals: true } },
          { hasError: { not_equals: true } },
        ],
      },
      overrideAccess: true,
      req,
    }),
  )
  if (open.totalDocs > 0) return
  await req.payload.jobs.queue({
    task: 'revenueGuardCheck' as 'sendEmail',
    input: {} as never,
    queue: TASK_DEFS.revenueGuardCheck.queue,
    req,
  })
  await jobAlarm.bump(requestNow(req)).catch(() => undefined)
}
