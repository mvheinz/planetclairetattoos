import 'server-only'

import { createLocalReq, type Payload } from 'payload'

import { notifyAdmin } from '@/lib/email/notifyAdmin'
import { runEmailJobNow } from '@/lib/email/outbox'
import { createLogger } from '@/lib/monitoring/logger'
import { preservingReq } from '@/lib/payload/localReq'
import { inTransaction } from '@/lib/payload/transaction'
import { addBerlinDays, berlinDateKey, berlinDayStart } from '@/lib/time'
import type { Order, Withdrawal } from '@/payload-types'

// Fristen-Erinnerung der Widerrufe (PLAN P6.9, KONZEPT §5.3 „Job-Erinnerung A13 an Tag 10“, R-094, DATENMODELL §11):
// offene Widerrufe (`received`, `goods_returned`) ohne Erstattung, deren Eingang mindestens 10 Berliner Kalendertage
// zurückliegt → A13 (`admin_withdrawal_deadline`) genau einmal je Widerruf (`deadlineReminderSentAt`, Idempotenz-
// Schlüssel). Beispieldaten (`seed = true`) bekommen keine Mail. Nie automatisch ablehnen.

const log = createLogger()
const DAY = 86_400_000
export const WITHDRAWAL_REMINDER_DAY = 10

const dayDiff = (a: Date, b: Date) =>
  Math.round(
    (Date.parse(`${berlinDateKey(b)}T00:00:00Z`) - Date.parse(`${berlinDateKey(a)}T00:00:00Z`)) /
      DAY,
  )

export async function runWithdrawalDeadlines(
  payload: Payload,
  now: Date,
): Promise<{ reminded: number }> {
  // Eingangstag ≤ heute − 10 (Berlin): Eingang vor dem Beginn von „heute − 9“
  const cutoff = addBerlinDays(berlinDayStart(now), -(WITHDRAWAL_REMINDER_DAY - 1))
  const res = await payload.find({
    collection: 'withdrawals',
    where: {
      and: [
        { status: { in: ['received', 'goods_returned'] } },
        { deadlineReminderSentAt: { exists: false } },
        { seed: { not_equals: true } },
        { receivedAt: { less_than: cutoff.toISOString() } },
      ],
    },
    sort: 'receivedAt',
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })
  let reminded = 0
  for (const w of res.docs as Withdrawal[]) {
    const req = await createLocalReq({ context: { system: true, now: now.toISOString() } }, payload)
    const job = await inTransaction(req, async () => {
      const fresh = (await preservingReq(req, () =>
        req.payload.findByID({
          collection: 'withdrawals',
          id: w.id,
          depth: 0,
          overrideAccess: true,
          req,
        }),
      )) as Withdrawal
      if (fresh.deadlineReminderSentAt) return null
      const orderId =
        typeof fresh.order === 'object' && fresh.order ? fresh.order.id : (fresh.order ?? null)
      const order = orderId
        ? ((await req.payload.findByID({
            collection: 'orders',
            id: orderId,
            depth: 0,
            overrideAccess: true,
            disableErrors: true,
            req,
          })) as Order | null)
        : null
      await preservingReq(req, () =>
        req.payload.update({
          collection: 'withdrawals',
          id: w.id,
          data: { deadlineReminderSentAt: now.toISOString() },
          depth: 0,
          overrideAccess: true,
          req,
          context: { ...req.context, system: true, now: now.toISOString() },
        }),
      )
      const a13 = await notifyAdmin(
        req,
        'admin_withdrawal_deadline',
        {
          withdrawalId: w.id,
          reference: w.reference,
          orderNumber: order?.orderNumber ?? null,
          refundDueAt: fresh.refundDueAt,
          daysLeft: Math.min(14, Math.max(0, dayDiff(now, new Date(fresh.refundDueAt)))),
        },
        {
          now,
          idempotencyKey: `admin_withdrawal_deadline:${w.id}`,
          relations: { withdrawal: w.id, order: orderId },
        },
      )
      return a13.jobId
    })
    if (job === null) continue
    reminded++
    await runEmailJobNow(payload, job, { now }).catch((e: unknown) =>
      log.error('withdrawal_deadlines.mail_failed', { id: w.id, error: (e as Error)?.message }),
    )
  }
  return { reminded }
}
