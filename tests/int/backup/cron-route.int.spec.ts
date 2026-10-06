import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import pg from 'pg'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { GET as backupRoute } from '@/app/(api)/api/cron/backup/route'
import { handleBackupCron, type BackupCronDeps, type BackupStatus } from '@/lib/backup/cron'
import { parseEnv, resetEnvCache, type Env } from '@/lib/env'
import { BACKUP_STATUS_KEY, computeFreshness } from '@/lib/monitoring/freshness'
import {
  __setSystemFilesForTests,
  createSystemFileStore,
  readJson,
} from '@/lib/storage/systemFiles'

import { getTestPayload } from '../helpers/payload'

// P10.9 – `GET /api/cron/backup` (ARCHITEKTUR §10.3, AK-A-10-03): nur APP_ENV=production und BACKUP_ENABLED=true (sonst
// 404 ohne DB-Verbindung), Bearer CRON_SECRET (sonst 401), Advisory-Lock, Status, Monatsstand, A12 bei Fehlern.

const SECRET = 'backup-test-secret-0123456789abcdefghij'
const NOW = new Date('2033-03-02T01:30:00.000Z')
let dir: string
const envWith = (over: Record<string, string>): Env =>
  parseEnv({
    ...process.env,
    CRON_SECRET: SECRET,
    STORAGE_DRIVER: 'local',
    STORAGE_LOCAL_DIR: dir,
    ...over,
  })
const req = (auth?: string) =>
  new Request('http://localhost:3000/api/cron/backup', {
    headers: auth ? { authorization: auth } : {},
  })
const countConnections = () => {
  const pool = vi.spyOn(pg.Pool.prototype, 'connect')
  const client = vi.spyOn(pg.Client.prototype, 'connect')
  return () => pool.mock.calls.length + client.mock.calls.length
}
const dumpResult = (key: string) => ({
  key,
  sizeBytes: 1234,
  sha256: 'a'.repeat(64),
  tables: 5,
  rows: 42,
  durationMs: 10,
  lastMigration: 'x',
  appVersion: 'dev',
  createdAt: NOW.toISOString(),
})

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'pc-bk-'))
  __setSystemFilesForTests(createSystemFileStore(envWith({})))
})
afterEach(() => vi.restoreAllMocks())
afterAll(async () => {
  __setSystemFilesForTests(undefined)
  await rm(dir, { recursive: true, force: true })
})

describe('GET /api/cron/backup', () => {
  it('AK-A-10-03 ohne Freigabe → 404 ohne DB-Verbindung (Pool-Zähler 0); auch mit gültigem Bearer', async () => {
    const connections = countConnections()
    const loadPayload = vi.fn()
    for (const env of [
      envWith({ APP_ENV: 'development', BACKUP_ENABLED: 'true' }),
      envWith({ APP_ENV: 'production', BACKUP_ENABLED: 'false' }),
    ]) {
      for (const auth of [undefined, `Bearer ${SECRET}`]) {
        const res = await handleBackupCron(req(auth), { env, now: NOW, loadPayload })
        expect(res.status).toBe(404)
      }
    }
    expect(loadPayload).not.toHaveBeenCalled()
    expect(connections()).toBe(0)
  })

  it('AK-A-10-03 Route-Handler mit echter Umgebung: nicht freigegeben → 404 ohne DB', async () => {
    resetEnvCache()
    const connections = countConnections()
    expect((await backupRoute(req(`Bearer ${SECRET}`))).status).toBe(404)
    expect(connections()).toBe(0)
  })

  it('AK-A-10-03 freigegeben, aber ohne/mit falschem Bearer → 401 ohne DB', async () => {
    const env = envWith({ APP_ENV: 'production', BACKUP_ENABLED: 'true' })
    const connections = countConnections()
    const loadPayload = vi.fn()
    for (const auth of [undefined, 'Bearer falsch', `Basic ${SECRET}`]) {
      expect((await handleBackupCron(req(auth), { env, now: NOW, loadPayload })).status).toBe(401)
    }
    expect(loadPayload).not.toHaveBeenCalled()
    expect(connections()).toBe(0)
  })

  it('Erfolg: Status geschrieben, Monatsstand einmal pro Monat, Frische meldet backup ok', async () => {
    const env = envWith({ APP_ENV: 'production', BACKUP_ENABLED: 'true' })
    const payload = await getTestPayload()
    const copyMonthly = vi.fn(async () => {})
    const mirror = vi.fn(async () => ({
      copied: 2,
      deleted: 0,
      markedMissing: 0,
      skippedPending: 0,
      remaining: 0,
      bytes: 10,
    }))
    const deps: BackupCronDeps = {
      env,
      now: NOW,
      loadPayload: async () => payload,
      dump: async () => dumpResult('db/daily/x.pcdump.gz.age'),
      copyMonthly,
      mirror,
    }
    const res = await handleBackupCron(req(`Bearer ${SECRET}`), deps)
    expect(res.status).toBe(200)
    const st = await readJson<BackupStatus>(BACKUP_STATUS_KEY)
    expect(st?.lastSuccessAt).toBe(NOW.toISOString())
    expect(st?.lastMonthlyKey).toContain('2033-03')
    expect(st?.mirror?.copied).toBe(2)
    expect(copyMonthly).toHaveBeenCalledTimes(1)
    await handleBackupCron(req(`Bearer ${SECRET}`), deps)
    expect(copyMonthly).toHaveBeenCalledTimes(1)
    expect(await computeFreshness(env, new Date(NOW.getTime() + 3600_000))).toMatchObject({
      backup: 'ok',
    })
    expect(await computeFreshness(env, new Date(NOW.getTime() + 31 * 3600_000))).toMatchObject({
      backup: 'late',
    })
    expect(await computeFreshness(envWith({ APP_ENV: 'development' }), NOW)).toMatchObject({
      backup: 'off',
    })
  })

  it('Fehler: 500, Fehlercode im Status ohne Personendaten, A12 gedrosselt', async () => {
    const env = envWith({ APP_ENV: 'production', BACKUP_ENABLED: 'true' })
    const payload = await getTestPayload()
    const deps: BackupCronDeps = {
      env,
      now: NOW,
      loadPayload: async () => payload,
      dump: async () => {
        throw Object.assign(new Error('Verbindung zu max@example.org verloren'), {
          code: 'ECONNRESET',
        })
      },
      copyMonthly: async () => {},
      mirror: async () => {
        throw new Error('nie')
      },
    }
    const res = await handleBackupCron(req(`Bearer ${SECRET}`), deps)
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('example.org')
    const st = await readJson<BackupStatus>(BACKUP_STATUS_KEY)
    expect(st?.errorCode).toBe('ECONNRESET')
    expect(st?.lastFailureAt).toBe(NOW.toISOString())
    expect(st?.lastSuccessAt).toBeDefined() // bisheriger Erfolg bleibt erhalten
  })
})
