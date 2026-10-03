import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import { createLocalReq, type Payload } from 'payload'

import { dbFor } from '@/lib/db/tx'
import { notifyAdmin } from '@/lib/email/notifyAdmin'
import { runEmailJobNow } from '@/lib/email/outbox'
import type { PrivacyRequestType } from '@/lib/enums'
import { createLogger } from '@/lib/monitoring/logger'
import { inTransaction } from '@/lib/payload/transaction'
import { berlinDateKey } from '@/lib/time'
import type { PrivacyRequest } from '@/payload-types'

import {
  OPEN_PRIVACY_REQUEST_STATUSES,
  privacyReminderDue,
  privacyRequestTarget,
} from './deadlines'

// Fristen-Erinnerung der Datenschutz-Anfragen (PLAN P6.16, KONZEPT §7.15, R-153, DATENMODELL §6.26 DM-PRQ-02): offene
// Anfragen (`received`, `identity_check`, `in_progress`) bekommen genau 7 Tage und 1 Tag vor `extendedDueAt ?? dueAt`
// je eine A14 (`admin_privacy_request_due`). Idempotent über `remindersSent` (Tag der Stufe) und den Idempotenz-
// Schlüssel der Outbox (Stufe + Fristtag). Als Fristen-Job überspringt er Beispieldaten (`seed = true`, DATENMODELL §11);
// „Heute“ zeigt sie trotzdem an.

const log = createLogger()

export interface PrivacyReminderResult {
  reminded: number
}

export async function runPrivacyRequestReminders(
  payload: Payload,
  now: Date,
): Promise<PrivacyReminderResult> {
  const res = await payload.find({
    collection: 'privacy-requests',
    where: {
      and: [{ status: { in: [...OPEN_PRIVACY_REQUEST_STATUSES] } }, { seed: { not_equals: true } }],
    },
    sort: 'dueAt',
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  let reminded = 0
  for (const r of res.docs as PrivacyRequest[]) {
    const target = privacyRequestTarget(r)
    const stage = privacyReminderDue(now, target, r.remindersSent as Record<string, unknown>)
    if (!stage) continue
    const req = await createLocalReq({ context: { system: true, now: now.toISOString() } }, payload)
    const jobId = await inTransaction(req, async () => {
      const db = await dbFor(req)
      const fresh = await db.execute(
        sql`SELECT reminders_sent FROM privacy_requests WHERE id = ${r.id} FOR UPDATE`,
      )
      const sent = (fresh.rows[0]?.reminders_sent ?? {}) as Record<string, unknown>
      if (privacyReminderDue(now, target, sent) !== stage) return null
      const next = { ...sent, [stage]: now.toISOString() }
      await db.execute(
        sql`UPDATE privacy_requests SET reminders_sent = ${JSON.stringify(next)}::jsonb WHERE id = ${r.id}`,
      )
      const a14 = await notifyAdmin(
        req,
        'admin_privacy_request_due',
        {
          privacyRequestId: r.id,
          reference: r.reference,
          type: (r.types?.[0] ?? 'access') as PrivacyRequestType,
          dueAt: target.toISOString(),
        },
        {
          now,
          idempotencyKey: `admin_privacy_request_due:${r.id}:${stage}:${berlinDateKey(target)}`,
        },
      )
      return a14.jobId
    })
    if (jobId === null) continue
    reminded++
    await runEmailJobNow(payload, jobId, { now }).catch((e: unknown) =>
      log.error('privacy_reminders.mail_failed', { id: r.id, error: (e as Error)?.message }),
    )
  }
  return { reminded }
}
