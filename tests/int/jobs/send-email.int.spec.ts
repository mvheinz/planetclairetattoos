import {
  commitTransaction,
  createLocalReq,
  initTransaction,
  killTransaction,
  type Payload,
} from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  __setEmailAdapterForTests,
  clearMemoryOutbox,
  createEmailAdapter,
  getMemoryOutbox,
} from '@/lib/email'
import { enqueueEmail } from '@/lib/email/outbox'
import { parseEnv } from '@/lib/env'
import { runTaskNow } from '@/lib/jobs/runTask'

import { getTestPayload } from '../helpers/payload'

// P1.9 – Outbox und Task `sendEmail` (DATENMODELL §1.5, §11; DM-JOB-01 Teil).

let payload: Payload
const TO = 'werkstatt@planetclaire.local'

async function countJobs(emailLogId: number): Promise<number> {
  const res = await payload.find({
    collection: 'payload-jobs',
    where: { 'input.emailLogId': { equals: emailLogId } },
    overrideAccess: true,
  })
  return res.totalDocs
}

async function countLogs(id: number): Promise<number> {
  const res = await payload.find({
    collection: 'email-log',
    where: { id: { equals: id } },
    overrideAccess: true,
  })
  return res.totalDocs
}

beforeAll(async () => {
  payload = await getTestPayload()
  __setEmailAdapterForTests(
    createEmailAdapter(parseEnv({ ...process.env, EMAIL_DRIVER: 'memory' })),
  )
})
afterAll(() => __setEmailAdapterForTests(undefined))
beforeEach(() => clearMemoryOutbox())

describe('Outbox (DATENMODELL §1.5)', () => {
  it('legt Zeile und Job in derselben Transaktion an: ein Rollback entfernt beide', async () => {
    const req = await createLocalReq({}, payload)
    await initTransaction(req)
    const res = await enqueueEmail(req, {
      template: 'admin_alert',
      to: TO,
      locale: 'de',
      subject: 'Rollback-Test',
    })
    expect(res.status).toBe('queued')
    expect(res.jobId).not.toBeNull()
    await killTransaction(req)
    expect(await countLogs(res.emailLogId)).toBe(0)
    expect(await countJobs(res.emailLogId)).toBe(0)
  })

  it('nach dem Commit existieren Zeile (queued) und Job (Queue email)', async () => {
    const req = await createLocalReq({}, payload)
    await initTransaction(req)
    const res = await enqueueEmail(req, {
      template: 'admin_alert',
      to: TO,
      locale: 'de',
      subject: 'Commit-Test',
    })
    await commitTransaction(req)
    const log = await payload.findByID({ collection: 'email-log', id: res.emailLogId })
    expect(log.status).toBe('queued')
    const job = await payload.findByID({
      collection: 'payload-jobs',
      id: res.jobId as number,
      overrideAccess: true,
    })
    expect(job).toMatchObject({ taskSlug: 'sendEmail', queue: 'email' })
  })
})

describe('Task sendEmail', () => {
  it('DM-JOB-01 (Teil): versendet genau einmal – ein zweiter Lauf versendet nicht erneut', async () => {
    const req = await createLocalReq({}, payload)
    const res = await enqueueEmail(req, {
      template: 'admin_alert',
      to: TO,
      locale: 'de',
      subject: 'Warnung: Test',
    })
    const runReq = await createLocalReq({ context: { now: '2026-10-15T08:00:00.000Z' } }, payload)
    await payload.jobs.runByID({ id: res.jobId as number, req: runReq })
    expect(getMemoryOutbox()).toHaveLength(1)
    expect(getMemoryOutbox()[0]).toMatchObject({
      to: [TO],
      subject: 'Warnung: Test',
      type: 'admin_alert',
      idempotencyKey: `admin_alert:email-log:${res.emailLogId}`,
    })
    expect(getMemoryOutbox()[0]?.text).toContain('Verwaltung')
    const log = await payload.findByID({ collection: 'email-log', id: res.emailLogId })
    expect(log).toMatchObject({ status: 'sent', transport: 'memory', attempts: 1 })
    expect(log.sentAt).toBe('2026-10-15T08:00:00.000Z')
    expect(log.messageId).toMatch(/@/)
    expect(log.bodySha256).toMatch(/^[a-f0-9]{64}$/)

    // Ein zweiter Job für dieselbe Zeile (erledigte Jobs löscht Payload): kein weiterer Versand.
    const again = await payload.jobs.queue({
      task: 'sendEmail',
      input: { emailLogId: res.emailLogId },
      queue: 'email',
    })
    await payload.jobs.runByID({ id: again.id, req: runReq })
    expect(getMemoryOutbox()).toHaveLength(1)
    const after = await payload.findByID({ collection: 'email-log', id: res.emailLogId })
    expect(after.attempts).toBe(1)
  })

  it('Fehler werden mit Versuch und Meldung protokolliert, die Zeile bleibt queued', async () => {
    const req = await createLocalReq({}, payload)
    const res = await enqueueEmail(req, {
      template: 'order_confirmation',
      to: TO,
      locale: 'de',
      subject: 'Deine Bestellung',
    })
    await payload.jobs.runByID({ id: res.jobId as number })
    expect(getMemoryOutbox()).toHaveLength(0)
    const log = await payload.findByID({ collection: 'email-log', id: res.emailLogId })
    expect(log).toMatchObject({ status: 'queued', attempts: 1 })
    expect(log.lastError).toContain('noch nicht umgesetzt')
    await payload.jobs.cancelByID({ id: res.jobId as number })
  })

  it('pnpm jobs:run sendEmail (runTaskNow) arbeitet wartende sendEmail-Jobs mit injizierter Zeit ab', async () => {
    const req = await createLocalReq({}, payload)
    const res = await enqueueEmail(req, {
      template: 'admin_alert',
      to: TO,
      locale: 'de',
      subject: 'Per jobs:run',
    })
    const result = await runTaskNow(payload, 'sendEmail', {
      now: new Date('2026-10-15T09:30:00.000Z'),
    })
    expect(result.ran).toBeGreaterThanOrEqual(1)
    const log = await payload.findByID({ collection: 'email-log', id: res.emailLogId })
    expect(log).toMatchObject({ status: 'sent', sentAt: '2026-10-15T09:30:00.000Z' })
  })
})
