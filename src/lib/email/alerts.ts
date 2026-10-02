import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import type { PayloadRequest } from 'payload'

import { dbFor } from '@/lib/db/tx'
import { requestNow } from '@/lib/payload/context'
import { inTransaction } from '@/lib/payload/transaction'

import { enqueueEmail, type EnqueueEmailResult } from './outbox'
import type { AdminAlertData } from './templates/adminAlert'

// A12 `admin_alert` (KONZEPT §6.4): höchstens eine Mail je Fehlerart und Stunde (gleitend, nach injizierter Zeit).
// Ausnahmen, die immer gehen, weil Geld zu erstatten ist bzw. eine Frist läuft: Zahlung zu einer beendeten Kasse
// (S16), Karte/PayPal bezahlt trotz Vorkasse (S17) und die beiden M08-Alarme (P6). Der Zeitpunkt steckt im
// Idempotenz-Schlüssel (`admin_alert:<Art>@<ISO-Zeit>`), so zählt die Sperre auch mit vorgestellter Uhr.

export const ADMIN_ALERT_INTERVAL_MS = 60 * 60 * 1000

/** Fehlerarten, die nie gedrosselt werden (KONZEPT §6.4). */
export const ALWAYS_ALERT_KINDS: ReadonlySet<string> = new Set([
  's16_payment_after_checkout_closed',
  's17_paid_despite_prepayment',
  'withdrawal_receipt_second_failure',
  'withdrawal_receipt_failed_24h',
])

const KIND_RE = /^[a-z0-9_.-]{1,80}$/

export interface AdminAlertInput extends AdminAlertData {
  /** Injizierte Zeit (Standard: `req.context.now` bzw. Systemuhr). */
  now?: Date
}

export type AdminAlertResult =
  EnqueueEmailResult | { status: 'throttled'; emailLogId: null; jobId: null }

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`)

/** Reiht A12 in der Transaktion von `req` ein – oder drosselt (gleiche Fehlerart innerhalb einer Stunde). */
export async function sendAdminAlert(
  req: PayloadRequest,
  input: AdminAlertInput,
): Promise<AdminAlertResult> {
  const { now: nowInput, ...data } = input
  if (!KIND_RE.test(data.kind))
    throw new Error(`Ungültige Fehlerart „${data.kind}“ (a–z, 0–9, _ . -).`)
  const now = nowInput ?? requestNow(req)
  const prefix = `admin_alert:${data.kind}@`
  return inTransaction(req, async () => {
    const db = await dbFor(req)
    await db.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${prefix}))`)
    if (!ALWAYS_ALERT_KINDS.has(data.kind)) {
      const last = await db.execute(sql`
        SELECT idempotency_key FROM email_log
        WHERE template = 'admin_alert' AND idempotency_key LIKE ${`${escapeLike(prefix)}%`}
        ORDER BY idempotency_key DESC LIMIT 1`)
      const key = last.rows[0]?.idempotency_key
      const at = typeof key === 'string' ? Date.parse(key.slice(prefix.length)) : NaN
      if (
        !Number.isNaN(at) &&
        now.getTime() - at < ADMIN_ALERT_INTERVAL_MS &&
        at <= now.getTime()
      ) {
        return { status: 'throttled', emailLogId: null, jobId: null }
      }
    }
    return enqueueEmail(req, {
      template: 'admin_alert',
      locale: 'de',
      data,
      idempotencyKey: `${prefix}${now.toISOString()}`,
    })
  })
}
