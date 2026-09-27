import { createLocalReq } from 'payload'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { parseEnv } from '@/lib/env'
import { jobNow } from '@/lib/jobs/now'

import { createIsolatedPayload, type IsolatedPayload } from '../helpers/isolatedPayload'

// Spike B-09 (ARCHITEKTUR Anhang B, §9.6): Stellen payload.jobs.handleSchedules() und payload.jobs.run() in 3.90.2 die
// angenommenen Funktionen bereit – auch mit injizierter Zeit? Test-Config mit geplantem Test-Task und vorgestellter Uhr.

const runs: { at: string; now: string }[] = []
let iso: IsolatedPayload

const setClock = (isoTime: string) => vi.setSystemTime(new Date(isoTime))

beforeAll(async () => {
  const env = parseEnv(process.env)
  iso = await createIsolatedPayload('spike_b09', {
    secret: env.PAYLOAD_SECRET,
    collections: [{ slug: 'users', auth: true, fields: [] }],
    admin: { user: 'users' },
    jobs: {
      tasks: [
        {
          slug: 'spikeHourly',
          schedule: [{ cron: '0 * * * *', queue: 'maintenance' }],
          handler: ({ req }) => {
            runs.push({ at: new Date().toISOString(), now: jobNow(req).toISOString() })
            return { output: {} }
          },
        },
      ],
    },
  })
})
afterEach(() => vi.useRealTimers())
afterAll(async () => {
  await iso?.close()
})

describe('Spike B-09: Payload-Jobs 3.90.2', () => {
  it('Funktionen vorhanden: handleSchedules, run, runByID, queue', () => {
    const { jobs } = iso.payload
    for (const fn of ['handleSchedules', 'run', 'runByID', 'queue', 'cancel'] as const) {
      expect(typeof jobs[fn]).toBe('function')
    }
  })

  it('geplanter Task wird durch einen Tick mit vorgestellter Uhr eingereiht und ausgeführt', async () => {
    const { payload } = iso
    vi.useFakeTimers({ toFake: ['Date'] })
    setClock('2026-10-15T08:10:00.000Z')

    // Tick 1 (08:10): einreihen mit waitUntil = nächste volle Stunde, noch nichts ausführen.
    const first = await payload.jobs.handleSchedules({ allQueues: true })
    expect(first.queued).toHaveLength(1)
    const pending = await payload.find({
      collection: 'payload-jobs',
      where: { taskSlug: { equals: 'spikeHourly' } },
      overrideAccess: true,
    })
    expect(pending.docs).toHaveLength(1)
    expect(pending.docs[0]).toMatchObject({ queue: 'maintenance' })
    expect(new Date(pending.docs[0]!.waitUntil as string).toISOString()).toBe(
      '2026-10-15T09:00:00.000Z',
    )
    await payload.jobs.run({ allQueues: true, limit: 50 })
    expect(runs).toHaveLength(0)

    // Zweiter handleSchedules vor Fälligkeit reiht nicht doppelt ein.
    expect((await payload.jobs.handleSchedules({ allQueues: true })).queued).toHaveLength(0)

    // Tick 2 (09:00:30, Uhr vorgestellt): Job ist fällig und läuft; die Zeit erreicht den Task über req.context.now.
    setClock('2026-10-15T09:00:30.000Z')
    const req = await createLocalReq({ context: { now: '2026-10-15T09:00:30.000Z' } }, payload)
    await payload.jobs.handleSchedules({ allQueues: true, req })
    await payload.jobs.run({ allQueues: true, limit: 50, req })
    expect(runs).toEqual([{ at: '2026-10-15T09:00:30.000Z', now: '2026-10-15T09:00:30.000Z' }])

    // Danach ist der nächste Lauf für 10:00 eingereiht (lastScheduledRun wird fortgeschrieben).
    await payload.jobs.handleSchedules({ allQueues: true, req })
    const next = await payload.find({
      collection: 'payload-jobs',
      where: {
        and: [{ taskSlug: { equals: 'spikeHourly' } }, { completedAt: { exists: false } }],
      },
      overrideAccess: true,
    })
    expect(next.docs.map((d) => new Date(d.waitUntil as string).toISOString())).toEqual([
      '2026-10-15T10:00:00.000Z',
    ])
  })
})
