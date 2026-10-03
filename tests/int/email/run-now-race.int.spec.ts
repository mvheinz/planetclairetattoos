import { createLocalReq, type Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  __setEmailAdapterForTests,
  clearMemoryOutbox,
  createEmailAdapter,
  getMemoryOutbox,
  type EmailAdapter,
} from '@/lib/email'
import { enqueueEmail, runEmailJobNow } from '@/lib/email/outbox'
import { parseEnv } from '@/lib/env'
import { TICK_LOCK, withTaskLock } from '@/lib/jobs/lock'

import { getTestPayload } from '../helpers/payload'

// Fix „commission.mail_failed: …reading 'log'“: Der Sofortversand (`runEmailJobNow`) lief gegen einen Job, den ein
// paralleler Lauf (Job-Wecker / `jobs.run`) schon beansprucht oder erledigt und gelöscht hatte. `payload.jobs.runByID`
// setzt `processing` ohne Bedingung; bei gelöschter Zeile liefert das Update `undefined` und Payloads `jobAfterRead`
// liest `undefined.log`. Gefordert: kein Fehler, keine doppelte und keine fehlende Mail.

let payload: Payload
let seq = 0
const T0 = '2026-10-03T08:00:00.000Z'

/** Memory-Treiber, dessen Versand `delayMs` dauert (macht Überschneidungen deterministisch). */
function slowMemory(delayMs: number): EmailAdapter {
  const inner = createEmailAdapter(parseEnv({ ...process.env, EMAIL_DRIVER: 'memory' }))
  return {
    ...inner,
    send: async (mail) => {
      await new Promise((r) => setTimeout(r, delayMs))
      return inner.send(mail)
    },
  }
}

async function queueAlert() {
  const key = `admin_alert:race-${Date.now()}-${++seq}@${T0}`
  const res = await enqueueEmail(await createLocalReq({}, payload), {
    template: 'admin_alert',
    locale: 'de',
    data: { kind: `race_${seq}`, summary: `Wettlauf ${seq}` },
    idempotencyKey: key,
  })
  expect(res.status).toBe('queued')
  return { ...res, key }
}

const mailsFor = (key: string) => getMemoryOutbox().filter((m) => m.idempotencyKey === key)

async function logStatus(id: number) {
  const doc = await payload.findByID({
    collection: 'email-log',
    id,
    depth: 0,
    overrideAccess: true,
  })
  return doc.status
}

beforeAll(async () => {
  payload = await getTestPayload()
})
afterAll(() => __setEmailAdapterForTests(undefined))
beforeEach(() => {
  __setEmailAdapterForTests(slowMemory(0))
  clearMemoryOutbox()
})

describe('runEmailJobNow – Wettlauf mit parallelem Job-Lauf', () => {
  it('Job schon von jobs.run erledigt und gelöscht → kein Fehler, genau eine Mail', async () => {
    const q = await queueAlert()
    await payload.jobs.run({ queue: 'email', limit: 50 })
    expect(mailsFor(q.key)).toHaveLength(1)
    await expect(runEmailJobNow(payload, q.jobId, { now: new Date(T0) })).resolves.toBeUndefined()
    expect(mailsFor(q.key)).toHaveLength(1)
    expect(await logStatus(q.emailLogId)).toBe('sent')
  })

  it('Job gerade von einem anderen Lauf beansprucht (processing) → Sofortlauf überspringt, keine Doppel-Mail', async () => {
    const q = await queueAlert()
    await payload.db.updateJobs({ id: q.jobId!, data: { processing: true }, req: {} })
    await expect(runEmailJobNow(payload, q.jobId, { now: new Date(T0) })).resolves.toBeUndefined()
    expect(mailsFor(q.key)).toHaveLength(0)
    // Der andere Lauf gibt den Job frei; der nächste Tick versendet genau einmal.
    await payload.db.updateJobs({ id: q.jobId!, data: { processing: false }, req: {} })
    await payload.jobs.run({ queue: 'email', limit: 50 })
    expect(mailsFor(q.key)).toHaveLength(1)
  })

  it('zwei Läufe führen denselben Job gleichzeitig aus (Payload beansprucht nicht atomar) → genau eine Mail', async () => {
    __setEmailAdapterForTests(slowMemory(40))
    const q = await queueAlert()
    const run = async () => {
      const req = await createLocalReq({ context: { now: T0 } }, payload)
      return payload.jobs.runByID({ id: q.jobId!, req })
    }
    // Payloads eigene Buchführung des zweiten Laufs darf scheitern (Job schon gelöscht – das fängt `runEmailJobNow`
    // ab); entscheidend ist die Sperre im Task: genau ein Versand.
    await Promise.allSettled([run(), run()])
    expect(mailsFor(q.key)).toHaveLength(1)
    expect(await logStatus(q.emailLogId)).toBe('sent')
  })

  it('Sofortlauf während eines Ticks → überspringt ohne Fehler; der Tick versendet genau einmal', async () => {
    const q = await queueAlert()
    let inner: Promise<void> | undefined
    const tick = await withTaskLock(payload, TICK_LOCK, async () => {
      inner = runEmailJobNow(payload, q.jobId, { now: new Date(T0) })
      await inner
      expect(mailsFor(q.key)).toHaveLength(0)
      await payload.jobs.run({ queue: 'email', limit: 50 })
    })
    expect(tick.status).toBe('ran')
    await expect(inner).resolves.toBeUndefined()
    expect(mailsFor(q.key)).toHaveLength(1)
  })

  it('Sofortlauf parallel zum Tick (50 Runden) → nie ein Fehler, je Mail genau ein Versand', async () => {
    __setEmailAdapterForTests(slowMemory(5))
    const tick = () =>
      withTaskLock(payload, TICK_LOCK, () => payload.jobs.run({ queue: 'email', limit: 50 }))
    for (let round = 0; round < 50; round++) {
      const q = await queueAlert()
      const results = await Promise.allSettled([
        runEmailJobNow(payload, q.jobId, { now: new Date(T0) }),
        tick(),
        runEmailJobNow(payload, q.jobId, { now: new Date(T0) }),
      ])
      const errors = results.flatMap((r) => (r.status === 'rejected' ? [String(r.reason)] : []))
      expect(errors, `Runde ${round}`).toEqual([])
      await tick() // nächster Tick holt Übersprungenes nach
      expect(mailsFor(q.key), `Runde ${round}`).toHaveLength(1)
    }
  }, 120_000)

  it('Sofortlauf parallel zu einem Lauf ohne Tick-Sperre (autoRun, 50 Runden) → Sofortlauf ohne Fehler, genau ein Versand', async () => {
    __setEmailAdapterForTests(slowMemory(5))
    for (let round = 0; round < 50; round++) {
      const q = await queueAlert()
      const [a, , b] = await Promise.allSettled([
        runEmailJobNow(payload, q.jobId, { now: new Date(T0) }),
        payload.jobs.run({ queue: 'email', limit: 50 }),
        runEmailJobNow(payload, q.jobId, { now: new Date(T0) }),
      ])
      const errors = [a, b].flatMap((r) => (r!.status === 'rejected' ? [String(r!.reason)] : []))
      expect(errors, `Runde ${round}`).toEqual([])
      await payload.jobs.run({ queue: 'email', limit: 50 })
      expect(mailsFor(q.key), `Runde ${round}`).toHaveLength(1)
      expect(await logStatus(q.emailLogId)).toBe('sent')
    }
  }, 120_000)
})
