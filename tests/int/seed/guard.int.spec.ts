import { spawnSync } from 'node:child_process'

import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { databaseNameFromUrl } from '@/lib/db/guard'
import { seedGuardBlockedReason, SEED_COMMANDS } from '@/lib/seed/guard'

// P1.28: Produktionssperre des Seeds (SEED-SPEC §1.5, ARCHITEKTUR §4.8, KONZEPT AK-11-04). Die CLI prüft vor dem Start
// von Payload über eine nur lesende Verbindung; der Test vergleicht einen Fingerabdruck aller Tabellen (Zeilenzahl
// und jüngstes `updated_at`) vor und nach dem Aufruf.

const url = process.env.DATABASE_URL_TEST!
let client: pg.Client

async function fingerprint(): Promise<string> {
  const tables = await client.query<{ table_name: string; has_updated: boolean }>(`
    SELECT t.table_name,
           EXISTS (SELECT 1 FROM information_schema.columns c
                   WHERE c.table_schema = 'public' AND c.table_name = t.table_name
                     AND c.column_name = 'updated_at') AS has_updated
    FROM information_schema.tables t
    WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
    ORDER BY t.table_name`)
  const parts: string[] = []
  for (const t of tables.rows) {
    const q = t.has_updated
      ? `SELECT count(*)::int AS n, max(updated_at)::text AS u FROM "${t.table_name}"`
      : `SELECT count(*)::int AS n, NULL AS u FROM "${t.table_name}"`
    const r = await client.query<{ n: number; u: string | null }>(q)
    parts.push(`${t.table_name}:${r.rows[0]!.n}:${r.rows[0]!.u ?? ''}`)
  }
  const comment = await client.query<{ c: string | null }>(
    "SELECT shobj_description(oid, 'pg_database') AS c FROM pg_database WHERE datname = current_database()",
  )
  return `${parts.join('|')}#${comment.rows[0]?.c ?? ''}`
}

function runSeed(script: string, args: string[], env: Record<string, string>) {
  return spawnSync('pnpm', ['-s', script, ...args], {
    env: { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: url, ...env },
    encoding: 'utf8',
    timeout: 120_000,
  })
}

beforeAll(async () => {
  client = new pg.Client({ connectionString: url })
  await client.connect()
})

afterAll(async () => {
  await client.end()
})

describe('Seed-Guard (AK-SEED-04, AK-11-04, AK-A-4-01)', () => {
  it.each([
    ['seed', []],
    ['seed:example', []],
    ['seed:remove', ['--yes']],
    ['seed:reset', []],
  ])(
    'AK-SEED-04/AK-11-04/AK-A-4-01: APP_ENV=production pnpm %s endet mit Exit 1 ohne Schreiboperation',
    async (script, args) => {
      const before = await fingerprint()
      const res = runSeed(script, args as string[], { APP_ENV: 'production' })
      expect(res.status, res.stderr).toBe(1)
      expect(res.stderr + res.stdout).toContain('APP_ENV=production')
      expect(await fingerprint()).toBe(before)
    },
    120_000,
  )

  it('AK-SEED-04/AK-11-04/AK-A-4-01: pnpm seed gegen eine als Produktion markierte DB endet mit Exit 1 ohne Schreiboperation', async () => {
    const name = databaseNameFromUrl(url)
    await client.query(`COMMENT ON DATABASE "${name}" IS 'planetclaire:production'`)
    try {
      const before = await fingerprint()
      const res = runSeed('seed', [], { APP_ENV: 'test' })
      expect(res.status, res.stderr).toBe(1)
      expect(res.stderr + res.stdout).toContain('als Produktion markiert')
      expect(await fingerprint()).toBe(before)
    } finally {
      await client.query(`COMMENT ON DATABASE "${name}" IS NULL`)
    }
  }, 120_000)

  it('AK-SEED-16: ein ungültiges SEED_NOW endet mit Exit 1 ohne Schreiboperation', async () => {
    const before = await fingerprint()
    const res = runSeed('seed', [], { APP_ENV: 'test', SEED_NOW: '2026-10-15T10:00:00' })
    expect(res.status, res.stderr).toBe(1)
    expect(res.stderr + res.stdout).toContain('SEED_NOW')
    expect(await fingerprint()).toBe(before)
  }, 120_000)

  it('AK-SEED-04: Regeln – nur seed:base ist in Produktion erlaubt; livemode-Bestellungen sperren', async () => {
    const quiet = {
      query: async (sql: string) =>
        sql.includes('to_regclass')
          ? { rows: [{ t: 'orders' }], rowCount: 1 }
          : { rows: [], rowCount: 0 },
    } as unknown as pg.Client
    const live = {
      query: async (sql: string) =>
        sql.includes('to_regclass')
          ? { rows: [{ t: 'orders' }], rowCount: 1 }
          : sql.includes('stripe_livemode')
            ? { rows: [{ '?column?': 1 }], rowCount: 1 }
            : { rows: [], rowCount: 0 },
    } as unknown as pg.Client
    for (const command of SEED_COMMANDS) {
      const reason = await seedGuardBlockedReason({ command, appEnv: 'production', db: quiet })
      if (command === 'base') expect(reason).toBeNull()
      else expect(reason).toMatch(/APP_ENV=production/)
      const liveReason = await seedGuardBlockedReason({ command, appEnv: 'test', db: live })
      if (command === 'base') expect(liveReason).toBeNull()
      else expect(liveReason).toMatch(/livemode/)
    }
    expect(await seedGuardBlockedReason({ command: 'all', appEnv: 'test', db: quiet })).toBeNull()
    // NODE_ENV/VERCEL_ENV spielen keine Rolle: nur APP_ENV zählt.
    expect(
      await seedGuardBlockedReason({ command: 'all', appEnv: 'development', db: quiet }),
    ).toBeNull()
  })
})
