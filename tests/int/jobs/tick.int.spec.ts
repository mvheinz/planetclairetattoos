import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import pg from 'pg'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { GET as tickRoute } from '@/app/(api)/api/cron/tick/route'
import { parseEnv, resetEnvCache, type Env } from '@/lib/env'
import { jobAlarm } from '@/lib/jobs/alarm'
import { handleRunTask, handleTick } from '@/lib/jobs/tick'
import { __setSystemFilesForTests, createSystemFileStore } from '@/lib/storage/systemFiles'

import { getTestPayload } from '../helpers/payload'

// P1.9 – Job-Wecker-Gerüst (ARCHITEKTUR §9.6, AK-A-9-01 Teil): Tick ohne Fälliges ohne DB-Verbindung, 204; ohne gültigen
// Bearer 401. Pool-Zähler: jeder Verbindungsaufbau über pg.Pool/pg.Client wird gezählt.

const SECRET = 'tick-test-secret-0123456789abcdefghijkl'
let dir: string
let env: Env
const NOW = new Date('2026-10-15T08:00:00.000Z')
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000)

const req = (auth?: string) =>
  new Request('http://localhost:3000/api/cron/tick', {
    headers: auth ? { authorization: auth } : {},
  })

function countConnections() {
  const pool = vi.spyOn(pg.Pool.prototype, 'connect')
  const client = vi.spyOn(pg.Client.prototype, 'connect')
  return () => pool.mock.calls.length + client.mock.calls.length
}

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'pc-tick-'))
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

describe('GET /api/cron/tick', () => {
  it('AK-A-9-01: ohne bzw. mit falschem Bearer-Token 401', async () => {
    const loadPayload = vi.fn()
    for (const auth of [undefined, 'Bearer falsch', `Basic ${SECRET}`, SECRET]) {
      const res = await handleTick(req(auth), { env, now: NOW, loadPayload })
      expect(res.status).toBe(401)
    }
    // Ohne gesetztes CRON_SECRET ist nichts erlaubt.
    const noSecret = parseEnv({ ...process.env, CRON_SECRET: '' })
    expect(
      (await handleTick(req('Bearer '), { env: noSecret, now: NOW, loadPayload })).status,
    ).toBe(401)
    expect(loadPayload).not.toHaveBeenCalled()
  })

  it('AK-A-9-01: nichts fällig → 204, keine DB-Verbindung (Pool-Zähler 0)', async () => {
    await jobAlarm.markFullRun(minutes(-10), minutes(30))
    const connections = countConnections()
    const loadPayload = vi.fn()
    const res = await handleTick(req(`Bearer ${SECRET}`), { env, now: NOW, loadPayload })
    expect(res.status).toBe(204)
    expect(loadPayload).not.toHaveBeenCalled()
    expect(connections()).toBe(0)
  })

  it('Route-Handler: ohne Fälliges 204 ohne DB (echte Umgebung über process.env)', async () => {
    await jobAlarm.markFullRun(new Date(), new Date(Date.now() + 30 * 60_000))
    vi.stubEnv('CRON_SECRET', SECRET)
    resetEnvCache()
    try {
      const connections = countConnections()
      expect((await tickRoute(req())).status).toBe(401)
      expect((await tickRoute(req(`Bearer ${SECRET}`))).status).toBe(204)
      expect(connections()).toBe(0)
    } finally {
      vi.unstubAllEnvs()
      resetEnvCache()
    }
  })

  it('fälliger Weckzeitpunkt → voller Lauf, neuer Weckzeitpunkt geschrieben', async () => {
    await jobAlarm.markFullRun(minutes(-10), minutes(-1))
    const payload = await getTestPayload()
    const res = await handleTick(req(`Bearer ${SECRET}`), {
      env,
      now: NOW,
      loadPayload: async () => payload,
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ status: 'ran' })
    const state = await jobAlarm.read()
    expect(state.lastFullRunAt).toBe(NOW.toISOString())
  })

  it('Sicherheitsnetz: letzter voller Lauf ≥ 60 min → fällig; bump zieht nur vor', async () => {
    await jobAlarm.markFullRun(minutes(-60), null)
    expect(await jobAlarm.isDue(NOW)).toBe(true)
    await jobAlarm.markFullRun(minutes(-59), null)
    expect(await jobAlarm.isDue(NOW)).toBe(false)
    await jobAlarm.bump(minutes(20))
    await jobAlarm.bump(minutes(40))
    expect((await jobAlarm.read()).nextDueAt).toBe(minutes(20).toISOString())
    await jobAlarm.bump(minutes(5))
    expect((await jobAlarm.read()).nextDueAt).toBe(minutes(5).toISOString())
    expect(await jobAlarm.isDue(minutes(5))).toBe(true)
  })
})

describe('POST /api/cron/run/[task]', () => {
  const run = (task: string, auth?: string) =>
    handleRunTask(
      new Request(`http://localhost:3000/api/cron/run/${task}`, {
        method: 'POST',
        headers: auth ? { authorization: auth } : {},
      }),
      task,
      { env, now: NOW, loadPayload: () => getTestPayload() },
    )

  it('ohne Bearer und ohne Admin-Sitzung 401', async () => {
    expect((await run('sendEmail')).status).toBe(401)
    expect((await run('sendEmail', 'Bearer falsch')).status).toBe(401)
  })

  it('nur Slugs aus Anhang A.3: unbekannt 404, noch nicht umgesetzt 409, sendEmail 200', async () => {
    expect((await run('dropDatabase', `Bearer ${SECRET}`)).status).toBe(404)
    const notYet = await run('markDelivered', `Bearer ${SECRET}`)
    expect(notYet.status).toBe(409)
    expect(await notYet.json()).toMatchObject({ phase: 'P5' })
    const ok = await run('sendEmail', `Bearer ${SECRET}`)
    expect(ok.status).toBe(200)
    expect(await ok.json()).toMatchObject({ status: 'ran', task: 'sendEmail' })
  })
})
