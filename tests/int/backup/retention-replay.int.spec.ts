import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { postgresAdapter, sql } from '@payloadcms/db-postgres'
import { generateIdentity, identityToRecipient } from 'age-encryption'
import { createReadStream } from 'node:fs'
import { getPayload, type Payload } from 'payload'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runBackup } from '@/lib/backup/run'
import { restoreFromCipher } from '@/lib/backup/restore'
import { replayDeletionLog } from '@/lib/retention/replay'
import { runRetentionTask } from '@/lib/retention/jobs'
import { runMigrations } from '../../../scripts/db-reset'

import { dbOf } from '../helpers/commerce'
import { getTestPayload } from '../helpers/payload'

// P10.9 – AK-A-10-04 (ARCHITEKTUR §10.5 Schritt 6 a, LOESCHKONZEPT §3.6): Widerruf nach dem Backup gelöscht, Backup in eine
// leere Datenbank eingespielt, `retention:replay` gegen die wiederhergestellte Datenbank → die ID aus dem Löschprotokoll
// existiert nicht mehr. Das Löschprotokoll liegt in der Datenbank; für den Test wird es aus dem Live-Stand in die
// wiederhergestellte Datenbank übernommen (so wie es nach einer Wiederherstellung aus einem Zeitpunkt nach der Löschung vorläge).

const SOURCE = process.env.DATABASE_URL_TEST as string
const withDb = (url: string, name: string) => {
  const u = new URL(url)
  u.pathname = `/${name}`
  return u.toString()
}
const TARGET_NAME = `${new URL(SOURCE).pathname.slice(1)}_replay`
const TARGET = withDb(SOURCE, TARGET_NAME)
const NOW = new Date('2034-02-01T10:00:00.000Z')

let dir: string
let restored: Payload | undefined

async function admin<T>(
  fn: (c: pg.Client) => Promise<T>,
  url = withDb(SOURCE, 'postgres'),
): Promise<T> {
  const c = new pg.Client({ connectionString: url })
  await c.connect()
  try {
    return await fn(c)
  } finally {
    await c.end()
  }
}

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'pc-replay-'))
  await admin(async (c) => {
    await c.query(`DROP DATABASE IF EXISTS "${TARGET_NAME}" WITH (FORCE)`)
    await c.query(`CREATE DATABASE "${TARGET_NAME}"`)
  })
  runMigrations(TARGET)
}, 280_000)

afterAll(async () => {
  await restored?.destroy().catch(() => undefined)
  const pool = (restored?.db as unknown as { pool?: pg.Pool } | undefined)?.pool
  if (pool && !pool.ended)
    await Promise.race([pool.end(), new Promise((r) => setTimeout(r, 3000))])
      .catch(() => undefined)
      .catch(() => undefined)
  await admin((c) => c.query(`DROP DATABASE IF EXISTS "${TARGET_NAME}" WITH (FORCE)`)).catch(
    () => undefined,
  )
  await rm(dir, { recursive: true, force: true })
}, 60_000)

describe('Wiederherstellung + retention:replay', () => {
  it('AK-A-10-04 nach Wiederherstellung und Replay existiert keine ID aus dem Löschprotokoll mehr', async () => {
    const live = await getTestPayload()
    const db = dbOf(live)
    await db.execute(sql`DELETE FROM deletion_log`)
    const w = await live.create({
      collection: 'withdrawals',
      data: {
        reference: 'WR-2026-00891',
        channel: 'online_form',
        locale: 'de',
        receivedAt: '2026-06-01T10:00:00.000Z',
        name: 'Rudi Beispiel',
        contractIdentification: 'Tasse vom Flohmarkt',
        email: 'rudi@planetclaire.local',
        matchStatus: 'needs_manual_match',
        status: 'received',
        refundDueAt: '2026-06-15T10:00:00.000Z',
        submissionSnapshot: { name: 'Rudi Beispiel' },
      } as never,
      overrideAccess: true,
      context: { seed: true },
    })

    // Backup „vor der Löschung“ (Wegwerf-Schlüssel, synthetische Daten)
    const identity = await generateIdentity()
    const recipient = await identityToRecipient(identity)
    const file = path.join(dir, 'b.pcdump.gz.age')
    await runBackup({
      connectionString: SOURCE,
      recipient,
      appVersion: 'test',
      now: new Date('2026-10-05T01:30:00Z'),
      target: { kind: 'file', path: file },
    })

    // Löschung nach dem Backup (Löschprotokoll-Eintrag)
    await runRetentionTask(live, 'retentionWithdrawals', { now: NOW })
    const gone = await db.execute(sql`SELECT 1 FROM withdrawals WHERE id = ${w.id}`)
    expect(gone.rows.length).toBe(0)
    const logRows = (await db.execute(sql`SELECT * FROM deletion_log`)).rows
    expect(logRows.length).toBeGreaterThan(0)

    // Wiederherstellung in die leere Datenbank (Schritt 3), Löschprotokoll übernommen
    const temp = path.join(dir, 'key.txt')
    await writeFile(temp, identity)
    await restoreFromCipher({ cipher: createReadStream(file), identity, targetUrl: TARGET })
    await admin(async (c) => {
      const before = await c.query('SELECT 1 FROM withdrawals WHERE id = $1', [w.id])
      expect(before.rows.length).toBe(1) // im Backup noch vorhanden
      for (const r of logRows) {
        const cols = Object.keys(r)
        await c.query(
          `INSERT INTO deletion_log (${cols.map((x) => `"${x}"`).join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')}) ON CONFLICT DO NOTHING`,
          cols.map((k) => r[k]),
        )
      }
    }, TARGET)

    // Replay gegen die wiederhergestellte Datenbank
    const { default: baseConfig } = await import('@payload-config')
    const config = await baseConfig
    restored = await getPayload({
      key: 'replay-target',
      config: Promise.resolve({
        ...config,
        db: postgresAdapter({ pool: { connectionString: TARGET, max: 3 }, push: false }),
      }) as never,
    })
    const res = await replayDeletionLog(restored, { now: NOW })
    expect(res.failed).toBe(0)
    expect(res.reapplied).toBeGreaterThan(0)
    const after = await admin(
      (c) => c.query('SELECT 1 FROM withdrawals WHERE id = $1', [w.id]),
      TARGET,
    )
    expect(after.rows.length).toBe(0)
    const again = await replayDeletionLog(restored, { now: NOW })
    expect(again.reapplied).toBe(0)
  }, 280_000)
})
