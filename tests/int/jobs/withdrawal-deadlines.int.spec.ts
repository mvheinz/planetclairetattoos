import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { __setEmailAdapterForTests, clearMemoryOutbox, createEmailAdapter } from '@/lib/email'
import { parseEnv } from '@/lib/env'
import { submitWithdrawal } from '@/lib/legal/withdrawal'
import { runWithdrawalDeadlines } from '@/lib/legal/withdrawalDeadlines'
import type { Withdrawal } from '@/payload-types'

import { dbOf } from '../helpers/commerce'
import { getTestPayload } from '../helpers/payload'

// P6.9 – Task `withdrawalDeadlines` (KONZEPT §5.3, R-094, AK-8-01): A13 genau einmal je Widerruf an Tag 10 (Berliner
// Kalendertage, vorgestellte Uhr), doppelter Lauf ohne zweite Mail, Beispieldaten (`seed = true`) ohne Mail.

const RECEIVED = new Date('2026-10-20T12:03:00.000Z') // Di 20.10.2026 14:03 MESZ
const DAY9 = new Date('2026-10-29T07:05:00.000Z') // 29.10. 08:05 MEZ
const DAY10 = new Date('2026-10-30T07:05:00.000Z') // 30.10. 08:05 MEZ
const EMAIL = 'frist@planetclaire.local'
let payload: Payload
let ipSeq = 0

async function withdrawal(): Promise<Withdrawal> {
  const res = await submitWithdrawal(
    { name: 'Erika Frist', contractIdentification: 'ohne Nummer', email: EMAIL, locale: 'de' },
    { now: RECEIVED, ip: `192.0.2.${100 + ++ipSeq}`, payload },
  )
  if (!res.ok || res.spam) throw new Error('kein Widerruf')
  return (await payload.findByID({
    collection: 'withdrawals',
    id: res.receipt.id,
    overrideAccess: true,
  })) as Withdrawal
}

async function a13For(id: number) {
  const res = await payload.find({
    collection: 'email-log',
    where: {
      and: [{ template: { equals: 'admin_withdrawal_deadline' } }, { withdrawal: { equals: id } }],
    },
    overrideAccess: true,
  })
  return res.docs
}

beforeAll(async () => {
  payload = await getTestPayload()
  await dbOf(payload).execute(sql`DELETE FROM withdrawals WHERE email = ${EMAIL}`)
})

afterAll(async () => {
  __setEmailAdapterForTests(undefined)
  await dbOf(payload).execute(
    sql`DELETE FROM email_log WHERE withdrawal_id IN (SELECT id FROM withdrawals WHERE email = ${EMAIL})`,
  )
  await dbOf(payload).execute(sql`DELETE FROM withdrawals WHERE email = ${EMAIL}`)
})

beforeEach(() => {
  __setEmailAdapterForTests(
    createEmailAdapter(parseEnv({ ...process.env, EMAIL_DRIVER: 'memory' })),
  )
  clearMemoryOutbox()
})

describe('withdrawalDeadlines (A13)', () => {
  it('AK-8-01 A13 genau einmal je Widerruf an Tag 10; doppelter Lauf ohne zweite Mail; seed ohne Mail', async () => {
    const real = await withdrawal()
    const sample = await withdrawal()
    await dbOf(payload).execute(sql`UPDATE withdrawals SET seed = true WHERE id = ${sample.id}`)

    await runWithdrawalDeadlines(payload, DAY9)
    expect(await a13For(real.id)).toHaveLength(0)

    await runWithdrawalDeadlines(payload, DAY10)
    await runWithdrawalDeadlines(payload, new Date(DAY10.getTime() + 3_600_000))
    const mails = await a13For(real.id)
    expect(mails).toHaveLength(1)
    expect(mails[0]!.subject).toContain(real.reference)
    expect(mails[0]!.subject).toContain('noch 4 Tage')
    const after = await payload.findByID({
      collection: 'withdrawals',
      id: real.id,
      overrideAccess: true,
    })
    expect(after.deadlineReminderSentAt).toBe(DAY10.toISOString())

    expect(await a13For(sample.id)).toHaveLength(0)
  })
})
