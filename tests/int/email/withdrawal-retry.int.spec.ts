import { sql } from '@payloadcms/db-postgres'
import { createLocalReq, type Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { getTodaySummary } from '@/lib/admin/today'
import {
  __setEmailAdapterForTests,
  clearMemoryOutbox,
  createEmailAdapter,
  getMemoryOutbox,
  type EmailAdapter,
} from '@/lib/email'
import { parseEnv } from '@/lib/env'
import { submitWithdrawal } from '@/lib/legal/withdrawal'

import { dbOf } from '../helpers/commerce'
import { withBusiness } from '../helpers/invoices'
import { getTestPayload } from '../helpers/payload'

// P6.7 – Wiederholung der Eingangsbestätigung M08 (R-093, ARCHITEKTUR Anhang A.3 `sendEmail`): höchstens alle 5 min
// bis 24 h nach Eingang; ab dem 2. Fehlversuch A12 und Hinweis unter „Heute“, nach 24 h `failed` und erneut A12.

const T0 = '2026-10-12T12:03:00.000Z'
const MIN = 60_000
let payload: Payload
let restoreBusiness: () => Promise<void>
let ipSeq = 0

const memory = () => createEmailAdapter(parseEnv({ ...process.env, EMAIL_DRIVER: 'memory' }))
const failing = (): EmailAdapter => {
  const inner = memory()
  return {
    driver: 'memory',
    transport: inner.transport,
    send: async () => {
      throw new Error('SMTP 451 vorübergehend nicht erreichbar')
    },
  }
}
const at = (ms: number) => new Date(Date.parse(T0) + ms)

async function receiptLog(withdrawalId: number) {
  const res = await payload.find({
    collection: 'email-log',
    where: {
      and: [
        { withdrawal: { equals: withdrawalId } },
        { template: { equals: 'withdrawal_receipt' } },
      ],
    },
    overrideAccess: true,
    depth: 0,
  })
  return res.docs[0]!
}

async function pendingJob(emailLogId: number) {
  const res = await payload.find({
    collection: 'payload-jobs',
    where: {
      and: [
        { 'input.emailLogId': { equals: emailLogId } },
        { completedAt: { exists: false } },
        { hasError: { not_equals: true } },
      ],
    },
    depth: 0,
    overrideAccess: true,
  })
  return res.docs
}

async function runPending(emailLogId: number, now: Date) {
  const jobs = await pendingJob(emailLogId)
  expect(jobs).toHaveLength(1)
  const job = jobs[0]!
  const req = await createLocalReq({ context: { now: now.toISOString() } }, payload)
  await payload.jobs.runByID({ id: job.id, req })
  return new Date(job.waitUntil as string)
}

async function alerts(kind: string) {
  const res = await payload.find({
    collection: 'email-log',
    where: { idempotencyKey: { like: `admin_alert:${kind}@` } },
    overrideAccess: true,
    limit: 20,
  })
  return res.docs
}

async function submit(email: string) {
  const res = await submitWithdrawal(
    {
      name: 'Erika Beispiel',
      contractIdentification: 'ohne Bestellnummer',
      email,
      locale: 'de',
    },
    { now: new Date(T0), ip: `198.51.100.${++ipSeq}`, payload },
  )
  if (!res.ok || res.spam) throw new Error('kein Datensatz')
  return res.receipt
}

beforeAll(async () => {
  payload = await getTestPayload()
  await dbOf(payload).execute(sql`DELETE FROM email_log`)
  await dbOf(payload).execute(sql`DELETE FROM withdrawals`)
  restoreBusiness = await withBusiness(payload)
})
afterAll(async () => {
  __setEmailAdapterForTests(undefined)
  await dbOf(payload).execute(sql`DELETE FROM email_log`)
  await dbOf(payload).execute(sql`DELETE FROM withdrawals`)
  await restoreBusiness()
})
beforeEach(async () => {
  clearMemoryOutbox()
  await dbOf(payload).execute(sql`DELETE FROM email_log WHERE template = 'admin_alert'`)
})

describe('M08 Wiederholung (R-093)', () => {
  it('R-093 Fehlversuche: alle ≤ 5 min bis 24 h, ab dem 2. Fehlversuch A12 + „Heute“, nach 24 h failed + A12', async () => {
    __setEmailAdapterForTests(failing())
    const r = await submit('fail@planetclaire.local')
    let log = await receiptLog(r.id)
    expect(log).toMatchObject({ status: 'queued', attempts: 1 })
    expect(await alerts('withdrawal_receipt_second_failure')).toHaveLength(0)

    // 2. Versuch nach 1 min → A12 (nie gedrosselt) und Hinweis unter „Heute“
    let wait = await runPending(log.id, at(MIN))
    expect(wait.toISOString()).toBe(at(MIN).toISOString())
    log = await receiptLog(r.id)
    expect(log).toMatchObject({ status: 'queued', attempts: 2 })
    expect(await alerts('withdrawal_receipt_second_failure')).toHaveLength(1)
    const today = await getTodaySummary(at(2 * MIN), payload)
    expect(today.hints.map((h) => h.id)).toContain('withdrawal-receipt-stuck')

    // weitere Versuche im 5-Minuten-Abstand, keine weiteren A12
    wait = await runPending(log.id, at(6 * MIN))
    expect(wait.toISOString()).toBe(at(6 * MIN).toISOString())
    const next = (await pendingJob(log.id))[0]!
    expect(new Date(next.waitUntil as string).toISOString()).toBe(at(11 * MIN).toISOString())
    expect(await alerts('withdrawal_receipt_second_failure')).toHaveLength(1)

    // kurz vor Ablauf von 24 h: nächster Versuch genau zum Fristende
    await runPending(log.id, at(24 * 60 * MIN - 2 * MIN))
    const last = (await pendingJob(log.id))[0]!
    expect(new Date(last.waitUntil as string).toISOString()).toBe(at(24 * 60 * MIN).toISOString())
    expect((await receiptLog(r.id)).status).toBe('queued')

    // nach 24 h: failed + A12
    await runPending(log.id, at(24 * 60 * MIN))
    log = await receiptLog(r.id)
    expect(log.status).toBe('failed')
    expect(await pendingJob(log.id)).toHaveLength(0)
    expect(await alerts('withdrawal_receipt_failed_24h')).toHaveLength(1)
    const w = await payload.findByID({ collection: 'withdrawals', id: r.id, overrideAccess: true })
    expect(w.confirmationSentAt ?? null).toBeNull()
  })

  it('R-093 Versand gelingt beim nächsten Versuch → sent, confirmationSentAt gesetzt', async () => {
    __setEmailAdapterForTests(failing())
    const r = await submit('later@planetclaire.local')
    const log = await receiptLog(r.id)
    expect(log.status).toBe('queued')
    __setEmailAdapterForTests(memory())
    await runPending(log.id, at(MIN))
    expect((await receiptLog(r.id)).status).toBe('sent')
    expect(getMemoryOutbox().filter((m) => m.type === 'withdrawal_receipt')).toHaveLength(1)
    const w = await payload.findByID({ collection: 'withdrawals', id: r.id, overrideAccess: true })
    expect(w.confirmationSentAt).toBe(at(MIN).toISOString())
  })
})
