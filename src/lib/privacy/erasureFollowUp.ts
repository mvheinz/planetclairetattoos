import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import { createLocalReq, type Payload, type PayloadRequest } from 'payload'

import { dbFor } from '@/lib/db/tx'
import { poolDb } from '@/lib/jobs/runLog'
import { createLogger, errorSummary } from '@/lib/monitoring/logger'
import { preservingReq } from '@/lib/payload/localReq'
import { inTransaction } from '@/lib/payload/transaction'
import type { Order, Withdrawal } from '@/payload-types'

import {
  ERASURE_FOLLOW_UP_KEY,
  followUpsOf,
  restrictOrder,
  restrictWithdrawal,
  runningOrderIds,
  type ErasureFollowUp,
} from './erasure'

// Nachlauf der Löschanfragen (Prüfung P18.5, LOESCHKONZEPT §5.6 Nr. 3): Bestellungen und Widerrufe, deren Vertrag beim
// Ausführen des Plans noch lief und die „keine Aktion“ bekamen, stehen in `privacy-requests.remindersSent.
// erasureFollowUp`. Der tägliche Lauf (Task `privacyRequestsDeadlineReminder`, ab 08:00) schränkt sie ein, sobald der
// Vertrag abgeschlossen ist (`orderStillRunning` ist falsch) und keine Mail zur Bestellung mehr in der Warteschlange
// wartet (sonst ginge z. B. die Erstattungsbestätigung M09 nicht mehr raus) – mit `deletion-log` (`trigger =
// privacy_request`, `ruleId = DSGVO`, Anfragenummer) und Audit `processing_restricted`. Erledigt ist ein Eintrag auch,
// wenn der Datensatz inzwischen gelöscht, anonymisiert, gesperrt oder schon eingeschränkt ist. Idempotent: je Eintrag
// eine Transaktion mit Zeilensperre auf der Anfrage; was erledigt ist, fällt aus der Liste; ein Fehler betrifft nur den
// Eintrag (nächster Lauf versucht es erneut). Beispieldaten (`seed = true`) bleiben außen vor wie bei den übrigen
// Fristen-Jobs.

const log = createLogger()

/** Mails zur Bestellung, die jünger sind und noch warten, halten den Nachlauf auf (danach gilt die Mail als hängend). */
export const FOLLOW_UP_PENDING_MAIL_DAYS = 7

export interface ErasureFollowUpResult {
  /** In diesem Lauf eingeschränkt. */
  restricted: number
  /** Weiter offen (Vertrag läuft noch bzw. Mail wartet). */
  pending: number
}

type Outcome = 'restricted' | 'pending' | 'done'

async function mailPending(req: PayloadRequest, orderId: number, now: Date): Promise<boolean> {
  const db = await dbFor(req)
  const since = new Date(now.getTime() - FOLLOW_UP_PENDING_MAIL_DAYS * 86_400_000).toISOString()
  const res = await db.execute(sql`
    SELECT 1 FROM email_log WHERE order_id = ${orderId} AND status = 'queued'
       AND created_at > ${since}::timestamptz LIMIT 1`)
  return res.rows.length > 0
}

async function load<T>(
  req: PayloadRequest,
  collection: 'orders' | 'withdrawals',
  id: number,
): Promise<T | null> {
  return (await preservingReq(req, () =>
    req.payload.findByID({
      collection,
      id,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
      req,
    }),
  )) as T | null
}

async function stillRunning(req: PayloadRequest, order: Order, now: Date): Promise<boolean> {
  return (await runningOrderIds(await dbFor(req), [order], now)).has(order.id)
}

async function followUpOne(
  req: PayloadRequest,
  entry: ErasureFollowUp,
  reference: string,
  now: Date,
): Promise<Outcome> {
  if (entry.collection === 'orders') {
    const order = await load<Order>(req, 'orders', entry.id)
    if (
      !order ||
      order.privacy?.anonymizedAt ||
      order.privacy?.legalHold ||
      order.privacy?.processingRestricted
    ) {
      return 'done'
    }
    if ((await stillRunning(req, order, now)) || (await mailPending(req, order.id, now))) {
      return 'pending'
    }
    await restrictOrder(req, order.id, reference, now)
    return 'restricted'
  }
  const withdrawal = await load<Withdrawal>(req, 'withdrawals', entry.id)
  if (!withdrawal || withdrawal.privacy?.legalHold || withdrawal.privacy?.processingRestricted) {
    return 'done'
  }
  const orderId =
    typeof withdrawal.order === 'object' && withdrawal.order
      ? withdrawal.order.id
      : (withdrawal.order ?? null)
  const order = orderId ? await load<Order>(req, 'orders', orderId) : null
  if (order && (await stillRunning(req, order, now))) return 'pending'
  await restrictWithdrawal(req, withdrawal.id, reference, now)
  return 'restricted'
}

const sameEntry = (a: ErasureFollowUp, b: ErasureFollowUp) =>
  a.collection === b.collection && a.id === b.id

/**
 * Ein Nachlauf-Eintrag in eigener Transaktion: Anfrage sperren, Eintrag prüfen, ggf. einschränken und aus der Liste
 * nehmen. Ein Fehler betrifft nur diesen Eintrag (er bleibt für den nächsten Lauf stehen).
 */
async function followUpEntry(
  req: PayloadRequest,
  requestId: number,
  entry: ErasureFollowUp,
  now: Date,
): Promise<Outcome> {
  const db = await dbFor(req)
  const res = await db.execute(
    sql`SELECT reference, reminders_sent FROM privacy_requests WHERE id = ${requestId} FOR UPDATE`,
  )
  const row = res.rows[0]
  if (!row) return 'done'
  const sent = (row.reminders_sent ?? {}) as Record<string, unknown>
  const entries = followUpsOf(sent)
  if (!entries.some((e) => sameEntry(e, entry))) return 'done'
  const outcome = await followUpOne(req, entry, String(row.reference), now)
  if (outcome !== 'pending') {
    const left = entries.filter((e) => !sameEntry(e, entry))
    await db.execute(sql`
      UPDATE privacy_requests SET reminders_sent = ${JSON.stringify({ ...sent, [ERASURE_FOLLOW_UP_KEY]: left })}::jsonb
       WHERE id = ${requestId}`)
  }
  return outcome
}

/** Alle gemerkten Nachläufe prüfen (täglicher Lauf). Fehler eines Eintrags halten die übrigen nicht auf. */
export async function runErasureFollowUps(
  payload: Payload,
  now: Date,
): Promise<ErasureFollowUpResult> {
  const res = await poolDb(payload).execute(sql`
    SELECT id, reminders_sent FROM privacy_requests
     WHERE seed IS NOT TRUE AND reminders_sent -> ${ERASURE_FOLLOW_UP_KEY} IS NOT NULL
       AND reminders_sent -> ${ERASURE_FOLLOW_UP_KEY} <> '[]'::jsonb
     ORDER BY id`)
  const total: ErasureFollowUpResult = { restricted: 0, pending: 0 }
  for (const r of res.rows) {
    const id = Number(r.id)
    const entries = followUpsOf(r.reminders_sent)
    for (const entry of entries) {
      try {
        const req = await createLocalReq(
          { context: { system: true, now: now.toISOString() } },
          payload,
        )
        const outcome = await inTransaction(req, () => followUpEntry(req, id, entry, now))
        if (outcome === 'restricted') total.restricted += 1
        if (outcome === 'pending') total.pending += 1
      } catch (e) {
        total.pending += 1
        log.warn('privacy.erasure_follow_up_failed', {
          id,
          collection: entry.collection,
          entityId: entry.id,
          error: errorSummary(e),
        })
      }
    }
  }
  if (total.restricted > 0 || total.pending > 0) log.info('privacy.erasure_follow_up', { ...total })
  return total
}
