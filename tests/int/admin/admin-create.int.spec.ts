import { spawnSync } from 'node:child_process'

import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PRODUCTION_DB_COMMENT, isProductionDatabase } from '@/lib/db/guard'

import { markProduction } from '../../../scripts/db-mark-production'

// P10.13 – Konto- und Produktionsschutz-Skripte (ARCHITEKTUR §4.8, §8.4, E-03): `admin:create` nimmt keine Argumente (Passwort
// nie als Argument), `db:mark-production` markiert einmalig; markierte Datenbanken verweigern Reset und Seed. (Kontenlogik
// selbst: tests/int/collections/users.int.spec.ts.)

const SOURCE = process.env.DATABASE_URL_TEST as string
const withDb = (name: string) => {
  const u = new URL(SOURCE)
  u.pathname = `/${name}`
  return u.toString()
}
const TMP = `${new URL(SOURCE).pathname.slice(1)}_mark_test`

async function admin<T>(fn: (c: pg.Client) => Promise<T>, url = withDb('postgres')): Promise<T> {
  const c = new pg.Client({ connectionString: url })
  await c.connect()
  try {
    return await fn(c)
  } finally {
    await c.end()
  }
}

beforeAll(async () => {
  await admin(async (c) => {
    await c.query(`DROP DATABASE IF EXISTS "${TMP}" WITH (FORCE)`)
    await c.query(`CREATE DATABASE "${TMP}"`)
  })
})
afterAll(async () => {
  await admin((c) => c.query(`DROP DATABASE IF EXISTS "${TMP}" WITH (FORCE)`))
})

describe('admin:create / admin:unlock / db:mark-production', () => {
  it('E-03 admin:create verweigert Argumente (Passwort nie als Argument)', () => {
    const r = spawnSync(
      'pnpm',
      ['-s', 'admin:create', 'jutta@example.com', 'geheim-passwort-1234'],
      {
        encoding: 'utf8',
        timeout: 120_000,
        env: { ...process.env, DATABASE_URL: SOURCE },
      },
    )
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('keine Argumente')
    expect(r.stdout + r.stderr).not.toContain('geheim-passwort-1234')
  })

  it('db:mark-production: markiert einmalig, zweiter Aufruf ändert nichts', async () => {
    const url = withDb(TMP)
    const result1 = await admin((c) => markProduction(c, TMP), url)
    expect(result1).toBe('marked')
    expect(await admin((c) => isProductionDatabase(c), url)).toBe(true)
    const comment = await admin(
      async (c) =>
        (
          await c.query(
            "SELECT shobj_description(oid,'pg_database') AS c FROM pg_database WHERE datname=$1",
            [TMP],
          )
        ).rows[0].c,
    )
    expect(comment).toBe(PRODUCTION_DB_COMMENT)
    expect(await admin((c) => markProduction(c, TMP), url)).toBe('already')
  })

  it('db:mark-production ohne --yes zeigt nur an', () => {
    const r = spawnSync('pnpm', ['-s', 'db:mark-production'], {
      encoding: 'utf8',
      timeout: 120_000,
      env: { ...process.env, DATABASE_URL: withDb(TMP), DATABASE_URL_UNPOOLED: withDb(TMP) },
    })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('würde')
  })

  it('AK-A-4-01 eine markierte Datenbank verweigert db:reset (Exit 1)', () => {
    const r = spawnSync('pnpm', ['-s', 'db:reset', '--test'], {
      encoding: 'utf8',
      timeout: 120_000,
      env: { ...process.env, DATABASE_URL_TEST: withDb(TMP), DATABASE_URL: withDb(TMP) },
    })
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('als Produktion markiert')
  })
})
