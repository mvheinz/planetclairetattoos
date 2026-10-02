import 'server-only'

import type { Payload } from 'payload'
import type { Pool } from 'pg'

import type { Clock } from '@/lib/time'

import { importBase } from './base'
import { importExample } from './example'
import { assertSeedAllowed, type SeedCommand } from './guard'
import type { SeedData } from './loader'
import { removeSeedData, seedSummary } from './remove'
import { SeedReport } from './report'

// Einstieg der Seed-Bibliothek (SEED-SPEC §1.4): `base`, `example`, `all`, `remove`, `reset`. Die CLI
// (`scripts/seed/cli.ts`) prüft Guard, `SEED_NOW` und Daten vor dem Start von Payload und ruft dann nur `runSeed` auf.

export interface RunSeedOptions {
  command: SeedCommand
  data: SeedData
  /** Referenzzeit N. */
  now: Date
  clock: Clock
  appEnv: string
  admin?: { email?: string; password?: string }
  yes?: boolean
  dropTexts?: boolean
  refreshMedia?: boolean
  only?: readonly string[]
}

export interface RunSeedResult {
  report: SeedReport
  /** Nur `remove` ohne `--yes`: Mengenvorschau. */
  summary?: Record<string, number>
}

export async function runSeed(payload: Payload, options: RunSeedOptions): Promise<RunSeedResult> {
  // Zweite Sperre für Aufrufe ohne CLI (nur lesend, vor dem ersten Schreiben).
  const pool = (payload.db as unknown as { pool?: Pool }).pool
  if (pool) await assertSeedAllowed({ command: options.command, appEnv: options.appEnv, db: pool })

  const report = new SeedReport()
  const base = async () => {
    if (!options.data.base) throw new Error('base.json fehlt.')
    await importBase(payload, options.data.base, {
      report,
      appEnv: options.appEnv,
      admin: options.admin,
    })
  }
  const example = () =>
    importExample(payload, options.data, {
      report,
      now: options.now,
      clock: options.clock,
      refreshMedia: options.refreshMedia,
      only: options.only,
      appEnv: options.appEnv,
    })
  const remove = async (keepTexts: boolean) => {
    const r = await removeSeedData(payload, { keepTexts, clock: options.clock })
    for (const [c, row] of r.counts) {
      for (const [outcome, n] of Object.entries(row)) {
        if (n > 0) report.add(c, outcome as never, n)
      }
    }
    for (const n of r.notes) report.note(n)
  }

  switch (options.command) {
    case 'base':
      await base()
      break
    case 'example':
      await example()
      break
    case 'all':
      await base()
      await example()
      break
    case 'remove':
      if (!options.yes) return { report, summary: await seedSummary(payload) }
      await remove(!options.dropTexts)
      break
    case 'reset':
      await remove(false)
      await base()
      await example()
      break
  }
  return { report }
}
