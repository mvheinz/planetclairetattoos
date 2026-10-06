import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import pg from 'pg'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { GET as freshnessRoute } from '@/app/(api)/api/health/freshness/route'
import { parseEnv, type Env } from '@/lib/env'
import { jobAlarm } from '@/lib/jobs/alarm'
import {
  __resetFreshnessCache,
  BACKUP_STATUS_KEY,
  cachedFreshness,
  computeFreshness,
  freshnessStatus,
} from '@/lib/monitoring/freshness'
import {
  __setSystemFilesForTests,
  createSystemFileStore,
  writeJson,
} from '@/lib/storage/systemFiles'

// P5.3 – `GET /api/health/freshness` (ARCHITEKTUR §2.5, §11.3): ohne DB; 200 bei frischem Lauf, 503 nach mehr als 3 h;
// Backup `off` außerhalb von Produktion, sonst `late` nach 30 h; Wartungsmodus 200; 60 s Cache.

let dir: string
let env: Env
const NOW = new Date('2026-10-15T12:00:00.000Z')
const hoursAgo = (h: number, from = NOW) => new Date(from.getTime() - h * 60 * 60_000)

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'pc-fresh-'))
  env = parseEnv({ ...process.env, STORAGE_DRIVER: 'local', STORAGE_LOCAL_DIR: dir })
  __setSystemFilesForTests(createSystemFileStore(env))
})
afterEach(() => {
  vi.restoreAllMocks()
  __resetFreshnessCache()
})
afterAll(async () => {
  __setSystemFilesForTests(undefined)
  await rm(dir, { recursive: true, force: true })
})

describe('Frische-Prüfung', () => {
  it('AK-A-11-03 Lauf vor 1 h → jobs ok, 200; vor 3 h 1 min → jobs late, 503; ohne Lauf → late', async () => {
    await jobAlarm.markFullRun(hoursAgo(1), null)
    const fresh = await computeFreshness(env, NOW)
    expect(fresh).toEqual({ jobs: 'ok', backup: 'off' })
    expect(freshnessStatus(fresh)).toBe(200)

    await jobAlarm.markFullRun(new Date(hoursAgo(3).getTime() - 60_000), null)
    const late = await computeFreshness(env, NOW)
    expect(late).toEqual({ jobs: 'late', backup: 'off' })
    expect(freshnessStatus(late)).toBe(503)

    await jobAlarm.markFullRun(hoursAgo(3), null)
    expect(await computeFreshness(env, NOW)).toMatchObject({ jobs: 'ok' })
  })

  it('Backup in Produktion mit BACKUP_ENABLED: ok bis 30 h, danach late (503)', async () => {
    await jobAlarm.markFullRun(hoursAgo(1), null)
    const prod = { ...env, APP_ENV: 'production', BACKUP_ENABLED: true } as Env
    expect(await computeFreshness(prod, NOW)).toMatchObject({ backup: 'late' }) // noch nie gesichert
    await writeJson(BACKUP_STATUS_KEY, { lastSuccessAt: hoursAgo(20).toISOString() })
    expect(await computeFreshness(prod, NOW)).toEqual({ jobs: 'ok', backup: 'ok' })
    await writeJson(BACKUP_STATUS_KEY, { lastSuccessAt: hoursAgo(31).toISOString() })
    const late = await computeFreshness(prod, NOW)
    expect(late).toMatchObject({ backup: 'late' })
    expect(freshnessStatus(late)).toBe(503)
  })

  it('Wartungsmodus → 200 mit { maintenance: true }', async () => {
    const f = await computeFreshness({ ...env, MAINTENANCE_MODE: true }, NOW)
    expect(f).toEqual({ maintenance: true })
    expect(freshnessStatus(f)).toBe(200)
  })

  it('60 s im Prozess gecacht', async () => {
    await jobAlarm.markFullRun(hoursAgo(1), null)
    expect(await cachedFreshness(env, NOW)).toMatchObject({ jobs: 'ok' })
    await jobAlarm.markFullRun(hoursAgo(5), null)
    expect(await cachedFreshness(env, new Date(NOW.getTime() + 59_000))).toMatchObject({
      jobs: 'ok',
    })
    expect(await cachedFreshness(env, new Date(NOW.getTime() + 61_000))).toMatchObject({
      jobs: 'late',
    })
  })

  it('Route: 200 bei frischem, 503 bei altem Lauf – ohne DB-Verbindung, no-store, keine Details', async () => {
    const pool = vi.spyOn(pg.Pool.prototype, 'connect')
    const client = vi.spyOn(pg.Client.prototype, 'connect')
    await jobAlarm.markFullRun(new Date(Date.now() - 10 * 60_000), null)
    const ok = await freshnessRoute()
    expect(ok.status).toBe(200)
    expect(ok.headers.get('cache-control')).toBe('no-store')
    expect(Object.keys(await ok.json()).sort()).toEqual(['backup', 'jobs'])

    __resetFreshnessCache()
    await jobAlarm.markFullRun(new Date(Date.now() - 4 * 60 * 60_000), null)
    const late = await freshnessRoute()
    expect(late.status).toBe(503)
    expect(await late.json()).toMatchObject({ jobs: 'late' })
    expect(pool.mock.calls.length + client.mock.calls.length).toBe(0)
  })
})
