import { spawnSync } from 'node:child_process'
import pg from 'pg'
import { describe, expect, it } from 'vitest'

import {
  databaseNameFromUrl,
  destructiveActionBlockedReason,
  isProductionDatabase,
} from '@/lib/db/guard'

const testUrl = process.env.DATABASE_URL_TEST!
const devUrl = (() => {
  const u = new URL(testUrl)
  u.pathname = '/planetclaire'
  return u.toString()
})()

function runReset(env: Record<string, string>) {
  return spawnSync('pnpm', ['-s', 'db:reset', '--test'], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
  })
}

describe('db:reset --test Schutz (ARCHITEKTUR §4.8)', () => {
  it('bricht gegen planetclaire (ohne _test) mit Exit 1 ab', () => {
    const res = runReset({ DATABASE_URL_TEST: devUrl })
    expect(res.status).toBe(1)
    expect(res.stderr + res.stdout).toContain('endet nicht auf _test')
  })

  it('bricht mit APP_ENV=production ab', () => {
    const res = runReset({ APP_ENV: 'production' })
    expect(res.status).toBe(1)
    expect(res.stderr + res.stdout).toContain('APP_ENV=production')
  })

  it('Guard-Regeln: Markierung und Name', () => {
    expect(
      destructiveActionBlockedReason({
        appEnv: 'test',
        databaseName: 'x_test',
        isProductionMarked: true,
      }),
    ).toMatch(/Produktion markiert/)
    expect(
      destructiveActionBlockedReason({
        appEnv: 'test',
        databaseName: 'x_test',
        isProductionMarked: false,
        requireTestSuffix: true,
      }),
    ).toBeNull()
  })

  it('erkennt die Produktions-Markierung per DB-Kommentar', async () => {
    const client = new pg.Client({ connectionString: testUrl })
    await client.connect()
    const name = databaseNameFromUrl(testUrl)
    try {
      expect(await isProductionDatabase(client)).toBe(false)
      await client.query(`COMMENT ON DATABASE "${name}" IS 'planetclaire:production'`)
      expect(await isProductionDatabase(client)).toBe(true)
      const res = runReset({})
      expect(res.status).toBe(1)
      expect(res.stderr + res.stdout).toContain('als Produktion markiert')
    } finally {
      await client.query(`COMMENT ON DATABASE "${name}" IS NULL`)
      await client.end()
    }
  })
})
