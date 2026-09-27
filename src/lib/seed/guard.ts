import 'server-only'

import type { ClientBase } from 'pg'

import { isProductionDatabase } from '@/lib/db/guard'

// Produktionssperre des Seeds (SEED-SPEC §1.5, ARCHITEKTUR §4.8, KONZEPT AK-11-04). Läuft, bevor irgendetwas
// geschrieben wird (die CLI prüft über eine eigene, nur lesende Verbindung, bevor Payload startet).
// `NODE_ENV` und `VERCEL_ENV` werden nicht ausgewertet; es gibt keinen Umgehungsschalter.

export const SEED_COMMANDS = ['base', 'example', 'all', 'remove', 'reset'] as const
export type SeedCommand = (typeof SEED_COMMANDS)[number]

/** Nur `seed:base` (Erstbefüllung P11) ist in Produktion erlaubt. */
export const SEED_COMMANDS_ALLOWED_IN_PRODUCTION: ReadonlySet<SeedCommand> = new Set(['base'])

export class SeedGuardError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SeedGuardError'
  }
}

export interface SeedGuardInput {
  command: SeedCommand
  /** Wert von `APP_ENV` (Standard `development`). */
  appEnv: string
  /** Nur lesende Abfragen (pg-Client oder Pool). */
  db: Pick<ClientBase, 'query'>
}

async function hasLiveOrders(db: Pick<ClientBase, 'query'>): Promise<boolean> {
  const table = await db.query<{ t: string | null }>("SELECT to_regclass('public.orders') AS t")
  if (!table.rows[0]?.t) return false
  const res = await db.query('SELECT 1 FROM orders WHERE stripe_livemode = true LIMIT 1')
  return (res.rowCount ?? res.rows.length) > 0
}

/** Ablehnungsgrund oder `null`, wenn der Befehl laufen darf. */
export async function seedGuardBlockedReason(input: SeedGuardInput): Promise<string | null> {
  if (SEED_COMMANDS_ALLOWED_IN_PRODUCTION.has(input.command)) return null
  const name = `seed${input.command === 'all' ? '' : `:${input.command}`}`
  if (input.appEnv === 'production') {
    return `${name} ist mit APP_ENV=production gesperrt. Beispieldaten entfernt in Produktion nur der Knopf „Beispieldaten entfernen“ in der Verwaltung.`
  }
  if (await isProductionDatabase(input.db)) {
    return `${name} abgebrochen: Die Datenbank ist als Produktion markiert (planetclaire:production).`
  }
  if (await hasLiveOrders(input.db)) {
    return `${name} abgebrochen: Es gibt Bestellungen mit echter Stripe-Zahlung (livemode).`
  }
  return null
}

/** Wirft `SeedGuardError`, wenn der Befehl gesperrt ist. */
export async function assertSeedAllowed(input: SeedGuardInput): Promise<void> {
  const reason = await seedGuardBlockedReason(input)
  if (reason) throw new SeedGuardError(reason)
}
