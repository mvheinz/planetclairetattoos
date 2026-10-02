import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { jobAlarm } from '@/lib/jobs/alarm'
import { listJobRuns, poolDb } from '@/lib/jobs/runLog'
import { runTaskNow } from '@/lib/jobs/runTask'
import { parseBerlinLocal } from '@/lib/time'

import { getTestPayload } from '../helpers/payload'

// P7.3 – Task `revalidateEndedOffers` (KONZEPT §8.2, DATENMODELL §11, R-171): erneuert `tattoo-offers`/`home` und
// R01/R11/R13, sobald seit dem letzten Lauf ein Beginn oder Ende erreicht ist, plus Sicherheitsnetz täglich ab 00:05
// Berlin; Weckzeit des nächsten Zeitpunkts per `jobAlarm.bump`; Speichern trägt Beginn/Ende als Weckzeit ein; ein
// doppelter Lauf hat keine zusätzliche Wirkung (AK-8-01).

const TASK = 'revalidateEndedOffers'
const at = (berlinLocal: string) => parseBerlinLocal(berlinLocal)!
const TAG = 'p7-revalidate-offers'

let payload: Payload
const ids: number[] = []

type Run = { status: string; counts: Record<string, unknown> | null }
async function runs(): Promise<Run[]> {
  return (await listJobRuns(poolDb(payload), { task: TASK, limit: 20 })).map((r) => ({
    status: r.status,
    counts: r.counts,
  }))
}

beforeAll(async () => {
  payload = await getTestPayload()
  await poolDb(payload).execute(sql`DELETE FROM job_runs WHERE task = ${TASK}`)
  await payload.delete({
    collection: 'tattoo-offers',
    where: { title: { like: TAG } },
    overrideAccess: true,
    context: { seed: true },
  })
  await payload.delete({
    collection: 'payload-jobs',
    where: { taskSlug: { equals: TASK } },
    overrideAccess: true,
  })
})

afterAll(async () => {
  await payload.delete({
    collection: 'tattoo-offers',
    where: { id: { in: ids } },
    overrideAccess: true,
    context: { seed: true },
  })
})

describe('revalidateEndedOffers (P7.3)', () => {
  it('AK-8-01 Ende erreicht ⇒ Erneuerung; doppelter Lauf ohne Wirkung; Sicherheitsnetz einmal je Tag', async () => {
    // Speichern trägt Beginn und Ende als Weckzeit ein (DM-OFF-01 „spätestens 15 min“).
    const saveNow = at('2026-10-14T08:00')
    await jobAlarm.markFullRun(saveNow, null)
    const offer = await payload.create({
      collection: 'tattoo-offers',
      data: {
        type: 'flash_day',
        title: `${TAG} Flash-Day`,
        description: 'Kleine Motive, großer Spaß.',
        startsAt: at('2026-10-14T12:00').toISOString(),
        endsAt: at('2026-10-14T19:00').toISOString(),
        published: true,
      } as never,
      overrideAccess: true,
      context: { now: saveNow.toISOString() },
    })
    ids.push(offer.id)
    expect((await jobAlarm.read()).nextDueAt).toBe(at('2026-10-14T12:00').toISOString())

    // 00:10 Berlin: Sicherheitsnetz des Tages (noch kein Beginn/Ende erreicht).
    await runTaskNow(payload, TASK, { now: at('2026-10-14T00:10') })
    let log = await runs()
    expect(log[0]).toMatchObject({ status: 'ok' })
    expect(log[0]!.counts).toMatchObject({ revalidated: true, period: '2026-10-14' })

    // 10:00: nichts fällig (Netz erledigt, Beginn noch nicht erreicht) ⇒ ohne Wirkung.
    await runTaskNow(payload, TASK, { now: at('2026-10-14T10:00') })
    log = await runs()
    expect(log[0]).toMatchObject({ status: 'skipped' })
    expect(log[0]!.counts).toMatchObject({ revalidated: false, targets: 0 })

    // 19:05: Ende erreicht (seit dem letzten Lauf auch der Beginn) ⇒ Erneuerung von Tags und Pfaden.
    const end = at('2026-10-14T19:05')
    await runTaskNow(payload, TASK, { now: end })
    log = await runs()
    expect(log[0]).toMatchObject({ status: 'ok' })
    expect(log[0]!.counts).toMatchObject({ revalidated: true, boundaries: 2, targets: 8 })

    // Doppelter Lauf zur selben Zeit: keine zusätzliche Wirkung (AK-8-01).
    await runTaskNow(payload, TASK, { now: end })
    log = await runs()
    expect(log[0]).toMatchObject({ status: 'skipped' })
    expect(log[0]!.counts).toMatchObject({ revalidated: false, boundaries: 0, targets: 0 })
    expect(log.filter((r) => r.status === 'ok')).toHaveLength(2)
  })

  it('Weckzeit: der Task trägt den nächsten Beginn bzw. das nächste Ende ein', async () => {
    const offer = await payload.create({
      collection: 'tattoo-offers',
      data: {
        type: 'aktion',
        title: `${TAG} Aktion`,
        description: 'Spontane Lücken diese Woche.',
        startsAt: at('2026-10-20T10:00').toISOString(),
        endsAt: at('2026-10-21T18:00').toISOString(),
        published: true,
      } as never,
      overrideAccess: true,
      context: { seed: true },
    })
    ids.push(offer.id)
    const now = at('2026-10-15T09:00')
    await jobAlarm.markFullRun(now, null)
    await runTaskNow(payload, TASK, { now })
    expect((await jobAlarm.read()).nextDueAt).toBe(at('2026-10-20T10:00').toISOString())
    const log = await runs()
    expect(log[0]!.counts).toMatchObject({ nextDueAt: at('2026-10-20T10:00').toISOString() })
  })
})
