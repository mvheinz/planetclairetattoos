import type { ClientBase } from 'pg'
import { describe, expect, it } from 'vitest'

import { PRODUCTION_DB_COMMENT } from '@/lib/db/guard'
import {
  assertSeedAllowed,
  SEED_COMMANDS,
  SeedGuardError,
  seedGuardBlockedReason,
  type SeedCommand,
} from '@/lib/seed/guard'

// P8.9: Produktionssperre des Seeds (SEED-SPEC §1.5, ARCHITEKTUR §4.8, AK-SEED-04, AK-11-04, AK-A-4-01) – jede
// Sperrbedingung einzeln, ohne Datenbank: Die Attrappe beantwortet nur die drei lesenden Abfragen des Guards und
// zählt jede andere Anweisung (es darf keine geben).

interface FakeDb {
  db: Pick<ClientBase, 'query'>
  statements: string[]
}

function fakeDb(opts: { productionComment?: boolean; liveOrder?: boolean; ordersTable?: boolean }) {
  const statements: string[] = []
  const query = async (sql: string) => {
    statements.push(sql)
    if (sql.includes('shobj_description')) {
      return {
        rows: [{ comment: opts.productionComment ? PRODUCTION_DB_COMMENT : null }],
        rowCount: 1,
      }
    }
    if (sql.includes('to_regclass')) {
      return { rows: [{ t: opts.ordersTable === false ? null : 'orders' }], rowCount: 1 }
    }
    if (sql.includes('stripe_livemode')) {
      return opts.liveOrder ? { rows: [{ '?column?': 1 }], rowCount: 1 } : { rows: [], rowCount: 0 }
    }
    throw new Error(`unerwartete Abfrage: ${sql}`)
  }
  return { db: { query } as unknown as Pick<ClientBase, 'query'>, statements } satisfies FakeDb
}

const BLOCKED: SeedCommand[] = SEED_COMMANDS.filter((c) => c !== 'base')

describe('Seed-Guard je Bedingung (AK-SEED-04, AK-11-04, AK-A-4-01)', () => {
  it('ohne Sperrbedingung laufen alle Befehle', async () => {
    for (const command of SEED_COMMANDS) {
      const { db } = fakeDb({})
      expect(await seedGuardBlockedReason({ command, appEnv: 'development', db })).toBeNull()
      await expect(assertSeedAllowed({ command, appEnv: 'test', db })).resolves.toBeUndefined()
    }
  })

  it.each(BLOCKED)(
    'AK-SEED-04: APP_ENV=production sperrt %s (ohne DB-Abfrage)',
    async (command) => {
      const { db, statements } = fakeDb({})
      const reason = await seedGuardBlockedReason({ command, appEnv: 'production', db })
      expect(reason).toMatch(/APP_ENV=production/)
      expect(statements).toEqual([])
      await expect(assertSeedAllowed({ command, appEnv: 'production', db })).rejects.toBeInstanceOf(
        SeedGuardError,
      )
    },
  )

  it.each(BLOCKED)(
    'AK-SEED-04: als Produktion markierte Datenbank (planetclaire:production) sperrt %s',
    async (command) => {
      const { db, statements } = fakeDb({ productionComment: true })
      expect(await seedGuardBlockedReason({ command, appEnv: 'development', db })).toMatch(
        /als Produktion markiert/,
      )
      expect(statements.every((s) => /^\s*SELECT/i.test(s))).toBe(true)
    },
  )

  it.each(BLOCKED)(
    'AK-SEED-04: Bestellung mit stripe.livemode = true sperrt %s',
    async (command) => {
      const { db, statements } = fakeDb({ liveOrder: true })
      expect(await seedGuardBlockedReason({ command, appEnv: 'preview', db })).toMatch(/livemode/)
      expect(statements.every((s) => /^\s*SELECT/i.test(s))).toBe(true)
    },
  )

  it('ohne Tabelle orders (frische DB) sperrt livemode nicht', async () => {
    const { db } = fakeDb({ ordersTable: false })
    expect(await seedGuardBlockedReason({ command: 'all', appEnv: 'test', db })).toBeNull()
  })

  it('seed:base ist auch unter jeder Sperrbedingung erlaubt (Erstbefüllung P11)', async () => {
    const { db, statements } = fakeDb({ productionComment: true, liveOrder: true })
    expect(await seedGuardBlockedReason({ command: 'base', appEnv: 'production', db })).toBeNull()
    expect(statements).toEqual([])
  })

  it('nur APP_ENV zählt: andere Werte (development, test, preview, staging, leer) sperren nicht', async () => {
    for (const appEnv of ['development', 'test', 'preview', 'staging', '']) {
      const { db } = fakeDb({})
      expect(await seedGuardBlockedReason({ command: 'reset', appEnv, db }), appEnv).toBeNull()
    }
  })
})
