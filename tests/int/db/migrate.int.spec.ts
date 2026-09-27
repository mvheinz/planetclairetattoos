import { spawnSync } from 'node:child_process'
import pg from 'pg'
import { describe, expect, it } from 'vitest'

// DM-P1-01: Migrationen laufen auf leerer DB fehlerfrei (PG 16 in der VM, PG 17 in CI), keine Drift.
describe('Migrationen (DATENMODELL §10)', () => {
  it('DM-P1-01 alle Migrationen sind angewendet', async () => {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL_TEST })
    await client.connect()
    try {
      const res = await client.query<{ name: string }>(
        'SELECT name FROM payload_migrations ORDER BY id',
      )
      expect(res.rows.map((r) => r.name)).toContain('20260927_094042_p1_baseline')
      const version = await client.query<{ server_version_num: string }>('SHOW server_version_num')
      expect(Number(version.rows[0]!.server_version_num)).toBeGreaterThanOrEqual(160000)
    } finally {
      await client.end()
    }
  })

  it('DM-P1-01 check:migrations meldet keine Drift', () => {
    const res = spawnSync('pnpm', ['-s', 'check:migrations'], {
      encoding: 'utf8',
      env: process.env,
    })
    expect(res.stdout + res.stderr).toContain('keine Drift')
    expect(res.status).toBe(0)
  }, 120_000)
})
