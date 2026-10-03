import { isImplementedTask, TASK_SLUGS } from '@/jobs/index'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { sql } from '@payloadcms/db-postgres'
import pg from 'pg'
import { createLocalReq, type Payload, type TaskConfig } from 'payload'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { WAKE_TASK_SLUGS } from '@/jobs/index'
import { parseEnv, type Env } from '@/lib/env'
import { jobAlarm } from '@/lib/jobs/alarm'
import { instrumentTask, jobFailedKind } from '@/lib/jobs/instrument'
import { listJobRuns, poolDb } from '@/lib/jobs/runLog'
import { handleRunTask, handleTick } from '@/lib/jobs/tick'
import { __setSystemFilesForTests, createSystemFileStore } from '@/lib/storage/systemFiles'

import { resetAdmin } from '../helpers/admin'
import { getTestPayload } from '../helpers/payload'

// P5.3 – Cron-Endpunkte (ARCHITEKTUR §2.5, §9.6), Lauf-Protokoll `job_runs` (DATENMODELL §11), T-18, DM-JOB-01:
// Tick ohne Fälliges ohne DB (204); parallele Ticks führen fällige Tasks genau einmal aus (Lock `tick`); einzelner Task
// 401/404/501/200 (Bearer oder Admin-Sitzung) mit Protokolleintrag; Fehlschlag in `commerce`/`documents` → A12.

const SECRET = 'cron-test-secret-0123456789abcdefghijklmn'
let dir: string
let env: Env
let payload: Payload

const tickReq = (auth?: string) =>
  new Request('http://localhost:3000/api/cron/tick', {
    headers: auth ? { authorization: auth } : {},
  })
const runReq = (task: string, auth?: string) =>
  new Request(`http://localhost:3000/api/cron/run/${task}`, {
    method: 'POST',
    headers: auth ? { authorization: auth } : {},
  })

async function runsAt(task: string, at: Date) {
  const res = await poolDb(payload).execute(sql`
    SELECT status FROM job_runs WHERE task = ${task} AND started_at = ${at.toISOString()}::timestamptz`)
  return res.rows.map((r) => String(r.status))
}

beforeAll(async () => {
  payload = await getTestPayload()
  dir = await mkdtemp(path.join(os.tmpdir(), 'pc-cron-'))
  env = parseEnv({
    ...process.env,
    CRON_SECRET: SECRET,
    STORAGE_DRIVER: 'local',
    STORAGE_LOCAL_DIR: dir,
  })
  __setSystemFilesForTests(createSystemFileStore(env))
})
afterEach(() => vi.restoreAllMocks())
afterAll(async () => {
  __setSystemFilesForTests(undefined)
  await rm(dir, { recursive: true, force: true })
})

describe('GET /api/cron/tick (T-18)', () => {
  it('ohne fällige Arbeit → 204 ohne DB-Verbindung (Pool-Zähler 0)', async () => {
    const now = new Date('2031-01-10T10:00:00.000Z')
    await jobAlarm.markFullRun(new Date(now.getTime() - 5 * 60_000), null)
    const pool = vi.spyOn(pg.Pool.prototype, 'connect')
    const client = vi.spyOn(pg.Client.prototype, 'connect')
    const loadPayload = vi.fn()
    const res = await handleTick(tickReq(`Bearer ${SECRET}`), { env, now, loadPayload })
    expect(res.status).toBe(204)
    expect(loadPayload).not.toHaveBeenCalled()
    expect(pool.mock.calls.length + client.mock.calls.length).toBe(0)
  })

  it('DM-JOB-01: zwei parallele Ticks mit fälliger Arbeit → jeder Wecker-Task läuft genau einmal', async () => {
    const now = new Date('2031-01-10T12:00:00.000Z')
    await jobAlarm.markFullRun(new Date(now.getTime() - 2 * 60 * 60_000), null)
    const deps = { env, now, loadPayload: () => getTestPayload() }
    const [a, b] = await Promise.all([
      handleTick(tickReq(`Bearer ${SECRET}`), deps),
      handleTick(tickReq(`Bearer ${SECRET}`), deps),
    ])
    expect([a.status, b.status].sort()).toEqual([200, 204])
    for (const task of WAKE_TASK_SLUGS) {
      expect(await runsAt(task, now), task).toHaveLength(1)
    }
    // Weckzeit geschrieben; dritter Tick zur selben Zeit hat nichts zu tun
    expect((await jobAlarm.read()).lastFullRunAt).toBe(now.toISOString())
    const again = await handleTick(tickReq(`Bearer ${SECRET}`), deps)
    expect(again.status).toBe(204)
    for (const task of WAKE_TASK_SLUGS) expect(await runsAt(task, now)).toHaveLength(1)
  })
})

describe('POST /api/cron/run/[task]', () => {
  const now = new Date('2031-02-03T09:00:00.000Z')
  const run = (task: string, auth?: string) =>
    handleRunTask(runReq(task, auth), task, { env, now, loadPayload: () => getTestPayload() })

  it('ohne Berechtigung 401, unbekannter Slug 404, spätere Phase 501', async () => {
    expect((await run('releaseExpiredReservations')).status).toBe(401)
    expect((await run('releaseExpiredReservations', 'Bearer falsch')).status).toBe(401)
    expect((await run('dropDatabase', `Bearer ${SECRET}`)).status).toBe(404)
    // Seit P7 sind alle Slugs aus Anhang A.3 umgesetzt; 501 gibt es nur noch für künftige Einträge.
    const pending = TASK_SLUGS.filter((s) => !isImplementedTask(s))
    for (const slug of pending) expect((await run(slug, `Bearer ${SECRET}`)).status).toBe(501)
    const p7 = await run('revalidateEndedOffers', `Bearer ${SECRET}`)
    expect(p7.status).toBe(200)
  })

  it('„Jetzt ausführen“ mit Bearer bzw. Admin-Sitzung → 200 und je Lauf ein Eintrag in job_runs', async () => {
    const ok = await run('releaseExpiredReservations', `Bearer ${SECRET}`)
    expect(ok.status).toBe(200)
    expect(await runsAt('releaseExpiredReservations', now)).toEqual(['ok'])

    const { token } = await resetAdmin(payload)
    const viaAdmin = await run('releaseExpiredReservations', `JWT ${token}`)
    expect(viaAdmin.status).toBe(200)
    expect(await runsAt('releaseExpiredReservations', now)).toEqual(['ok', 'ok'])
  })
})

describe('Lauf-Protokoll und A12 bei Fehlschlag', () => {
  const failing = (slug: string): TaskConfig<{ input: Record<string, never>; output: object }> => ({
    slug: slug as never,
    handler: async () => {
      throw new Error('Verbindung zu kunde@planetclaire.local abgebrochen')
    },
  })

  async function invoke(task: TaskConfig<never>, now: Date) {
    const req = await createLocalReq({ context: { system: true, now: now.toISOString() } }, payload)
    const handler = task.handler as (args: unknown) => Promise<unknown>
    return handler({ req, input: {}, job: {}, tasks: {}, inlineTask: () => undefined })
  }

  async function alertsOf(kind: string) {
    return payload.find({
      collection: 'email-log',
      where: { idempotencyKey: { like: `admin_alert:${kind}@` } },
      overrideAccess: true,
      depth: 0,
    })
  }

  it('R-137: Fehlschlag in commerce → Eintrag „failed“ mit geschwärztem Fehler und genau eine A12 je Stunde', async () => {
    const slug = `p53FailCommerce${Date.now().toString(36)}`
    const task = instrumentTask(failing(slug), 'commerce') as unknown as TaskConfig<never>
    const t0 = new Date('2031-03-01T08:00:00.000Z')
    await expect(invoke(task, t0)).rejects.toThrow(/abgebrochen/)
    await expect(invoke(task, new Date(t0.getTime() + 10 * 60_000))).rejects.toThrow()
    const runs = await listJobRuns(poolDb(payload), { task: slug })
    expect(runs.map((r) => r.status)).toEqual(['failed', 'failed'])
    expect(runs[0]!.error).toContain('[redacted]')
    expect(runs[0]!.error).not.toContain('@planetclaire.local')
    const alerts = await alertsOf(jobFailedKind(slug))
    expect(alerts.docs).toHaveLength(1)
    expect(alerts.docs[0]!.subject).toContain(slug)
  })

  it('Fehlschlag in maintenance → nur Protokoll, keine A12', async () => {
    const slug = `p53FailMaint${Date.now().toString(36)}`
    const task = instrumentTask(failing(slug), 'maintenance') as unknown as TaskConfig<never>
    await expect(invoke(task, new Date('2031-03-02T08:00:00.000Z'))).rejects.toThrow()
    expect((await listJobRuns(poolDb(payload), { task: slug })).map((r) => r.status)).toEqual([
      'failed',
    ])
    expect((await alertsOf(jobFailedKind(slug))).docs).toHaveLength(0)
  })

  it('Ausgabe skipped → Status „skipped“; Zähler ohne Inhalte', async () => {
    const slug = `p53Skip${Date.now().toString(36)}`
    const task = instrumentTask(
      {
        slug: slug as never,
        handler: async () => ({
          output: { skipped: true, notified: 0, note: 'x y z mit Leerzeichen' },
        }),
      } as unknown as TaskConfig<{ input: Record<string, never>; output: object }>,
      'maintenance',
    ) as unknown as TaskConfig<never>
    await invoke(task, new Date('2031-03-03T08:00:00.000Z'))
    const [row] = await listJobRuns(poolDb(payload), { task: slug })
    expect(row!.status).toBe('skipped')
    expect(row!.counts).toEqual({ skipped: true, notified: 0 })
  })
})
