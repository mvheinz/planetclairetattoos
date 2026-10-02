import { sql } from '@payloadcms/db-postgres'
import { createLocalReq, type Payload, type TaskConfig } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { instrumentTask } from '@/lib/jobs/instrument'
import { withTaskLock } from '@/lib/jobs/lock'
import { jobNow } from '@/lib/jobs/now'
import { periodOf, runOncePer, type RunPeriod } from '@/lib/jobs/runOnce'
import { poolDb } from '@/lib/jobs/runLog'
import { berlinDateKey, berlinMonthKey, formatBerlin } from '@/lib/time'

import { getTestPayload } from '../helpers/payload'

// P5.3 – `runOncePer` (KONZEPT §8.1 Nr. 3, ARCHITEKTUR §9.6 Nr. 5): tägliche/monatliche Tasks laufen beim ersten vollen
// Lauf nach der Berliner Uhrzeit, höchstens einmal je Berliner Tag bzw. Monat – auch an den Tagen der Zeitumstellung
// (29.03.2026: 23 Stunden, 25.10.2026: 25 Stunden). Simuliert werden stündliche volle Läufe des Job-Weckers.

let payload: Payload
const suffix = Date.now().toString(36)
const slugs: string[] = []

/** Test-Task mit Lock, Lauf-Protokoll und `runOncePer`, der seine Ausführungen zählt. */
function onceTask(per: RunPeriod, hour: number) {
  const slug = `p53Once${per}${slugs.length}${suffix}`
  slugs.push(slug)
  const executed: { at: Date; period: string }[] = []
  const task = instrumentTask(
    {
      slug: slug as never,
      handler: async ({ req }) => {
        const now = jobNow(req)
        const run = await withTaskLock(req.payload, slug, async () => {
          const decision = await runOncePer(poolDb(req.payload), slug, per, hour, now)
          if (!decision.due) return null
          executed.push({ at: now, period: decision.period })
          return decision.period
        })
        if (run.status === 'locked' || run.result === null) return { output: { skipped: true } }
        return { output: { skipped: false, period: run.result } }
      },
    } as TaskConfig<{ input: Record<string, never>; output: object }>,
    'maintenance',
  ) as unknown as TaskConfig<never>
  const invoke = async (now: Date) => {
    const req = await createLocalReq({ context: { system: true, now: now.toISOString() } }, payload)
    await (task.handler as (a: unknown) => Promise<unknown>)({ req, input: {}, job: {}, tasks: {} })
  }
  return { slug, executed, invoke }
}

function hourly(fromIso: string, hours: number): Date[] {
  const start = Date.parse(fromIso)
  return Array.from({ length: hours }, (_, i) => new Date(start + i * 60 * 60_000))
}

beforeAll(async () => {
  payload = await getTestPayload()
})
afterAll(async () => {
  for (const slug of slugs) {
    await poolDb(payload).execute(sql`DELETE FROM job_runs WHERE task = ${slug}`)
  }
})

describe('periodOf (rein)', () => {
  it('Tag: Berliner Datum; Uhrzeit erreicht ab der Berliner Stunde (Sommer- und Winterzeit)', () => {
    // 29.03.2026 01:30 UTC = 03:30 MESZ (nach der Umstellung 02→03)
    expect(periodOf('day', 3, new Date('2026-03-29T01:30:00.000Z'))).toEqual({
      period: '2026-03-29',
      reached: true,
    })
    // 25.10.2026 00:30 UTC = 02:30 MESZ, 01:30 UTC = 02:30 MEZ (Stunde doppelt)
    expect(periodOf('day', 3, new Date('2026-10-25T01:30:00.000Z')).reached).toBe(false)
    expect(periodOf('day', 3, new Date('2026-10-25T02:00:00.000Z')).reached).toBe(true)
    // 22:30 UTC am Vortag ist in Berlin schon der nächste Tag
    expect(periodOf('day', 0, new Date('2026-10-24T22:30:00.000Z')).period).toBe('2026-10-25')
  })

  it('Monat: ab dem 1. um die Berliner Stunde, an späteren Tagen immer', () => {
    expect(periodOf('month', 4, new Date('2026-11-01T02:59:00.000Z'))).toEqual({
      period: '2026-11',
      reached: false,
    })
    expect(periodOf('month', 4, new Date('2026-11-01T03:00:00.000Z')).reached).toBe(true)
    expect(periodOf('month', 4, new Date('2026-11-02T00:00:00.000Z')).reached).toBe(true)
  })
})

describe('runOncePer mit Lauf-Protokoll (DM-JOB-01)', () => {
  for (const [label, from] of [
    ['Sommerzeit-Beginn 29.03.2026', '2026-03-27T22:00:00.000Z'],
    ['Winterzeit-Beginn 25.10.2026', '2026-10-23T22:00:00.000Z'],
  ] as const) {
    it(`täglicher Task (ab 03:00) läuft am ${label} genau einmal je Berliner Tag`, async () => {
      const t = onceTask('day', 3)
      const times = hourly(from, 4 * 24)
      for (const at of times) {
        await t.invoke(at)
        // zweiter voller Lauf in derselben Minute (z. B. „Jetzt ausführen“) ohne Doppelwirkung
        await t.invoke(new Date(at.getTime() + 30_000))
      }
      const days = [...new Set(times.map((d) => berlinDateKey(d)))]
      const perDay = new Map<string, number>()
      for (const e of t.executed) perDay.set(e.period, (perDay.get(e.period) ?? 0) + 1)
      for (const day of days) expect(perDay.get(day), day).toBe(1)
      for (const e of t.executed) {
        expect(berlinDateKey(e.at)).toBe(e.period)
        expect(Number(formatBerlin(e.at, 'H'))).toBeGreaterThanOrEqual(3)
      }
    })
  }

  it('monatlicher Task (am 1. ab 04:00) läuft einmal je Monat, verpasster 1. wird am 2. nachgeholt', async () => {
    const t = onceTask('month', 4)
    for (const at of hourly('2026-10-31T23:00:00.000Z', 12)) await t.invoke(at)
    // Kein voller Lauf am 1.12.; erster Lauf am 2.12.
    for (const at of hourly('2026-12-02T08:00:00.000Z', 3)) await t.invoke(at)
    expect(t.executed.map((e) => e.period)).toEqual(['2026-11', '2026-12'])
    expect(t.executed[0]!.at.toISOString()).toBe('2026-11-01T03:00:00.000Z')
    expect(berlinMonthKey(t.executed[1]!.at)).toBe('2026-12')
  })
})
