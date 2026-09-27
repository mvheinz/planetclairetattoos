// Seed-CLI (SEED-SPEC §1.4, ARCHITEKTUR §6.10): payload run scripts/seed/cli.ts -- <base|example|all|remove|reset>
// Optionen: --yes, --drop-texts (remove), --only=<collection,…>, --refresh-media (example).
// Die Logik liegt in src/lib/seed/; dieses Skript prüft vor dem Start von Payload die Produktionssperre (eigene, nur
// lesende Verbindung), `SEED_NOW` und die Datendateien (alles oder nichts) und ruft dann nur die Bibliothek auf.
import pg from 'pg'

import {
  SEED_COMMANDS,
  SeedGuardError,
  assertSeedAllowed,
  type SeedCommand,
} from '../../src/lib/seed/guard'
import { loadSeedData, SeedDataError } from '../../src/lib/seed/loader'
import { parseSeedNow, SeedTimeError } from '../../src/lib/seed/time'
import { systemClock } from '../../src/lib/time'

export interface SeedCliArgs {
  command: SeedCommand
  yes: boolean
  dropTexts: boolean
  refreshMedia: boolean
  only?: string[]
}

export function parseSeedArgs(argv: readonly string[]): SeedCliArgs {
  const positional = argv.filter((a) => !a.startsWith('--'))
  const command = positional[0] as SeedCommand | undefined
  if (!command || !SEED_COMMANDS.includes(command)) {
    throw new Error(
      `Aufruf: seed <${SEED_COMMANDS.join('|')}> [--yes] [--drop-texts] [--only=…] [--refresh-media]`,
    )
  }
  const only = argv.find((a) => a.startsWith('--only='))
  return {
    command,
    yes: argv.includes('--yes'),
    dropTexts: argv.includes('--drop-texts'),
    refreshMedia: argv.includes('--refresh-media'),
    only: only ? only.slice('--only='.length).split(',').filter(Boolean) : undefined,
  }
}

async function main(): Promise<void> {
  const args = parseSeedArgs(process.argv.slice(2))
  // Skripte dürfen vor dem App-Start process.env lesen (ARCHITEKTUR §5.1).
  const appEnv = process.env.APP_ENV || 'development'
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL fehlt.')

  // 1. Produktionssperre – bevor irgendetwas schreibt (SEED-SPEC §1.5).
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    await assertSeedAllowed({ command: args.command, appEnv, db: client })
  } finally {
    await client.end()
  }

  // 2. Referenzzeit N und Daten (alles oder nichts, §1.7 Schritt 1).
  const now = parseSeedNow(process.env.SEED_NOW, systemClock)
  const data = await loadSeedData({
    now,
    requireBase: args.command === 'base' || args.command === 'all' || args.command === 'reset',
  })

  // 3. Payload starten und die Bibliothek aufrufen.
  const { getPayload } = await import('payload')
  const { default: config } = await import('../../src/payload.config')
  const { runSeed } = await import('../../src/lib/seed/run')
  const payload = await getPayload({ config })
  try {
    const { report, summary } = await runSeed(payload, {
      command: args.command,
      data,
      now,
      clock: systemClock,
      appEnv,
      admin: { email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD },
      yes: args.yes,
      dropTexts: args.dropTexts,
      refreshMedia: args.refreshMedia,
      only: args.only,
    })
    if (summary) {
      console.log('seed:remove – Vorschau (mit --yes wird gelöscht):')
      for (const [c, n] of Object.entries(summary)) console.log(`  ${c}: ${n}`)
      if (Object.keys(summary).length === 0) console.log('  keine Beispieldaten vorhanden')
    }
    console.log(`seed ${args.command} (N = ${now.toISOString()}):`)
    for (const line of report.lines()) console.log(`  ${line}`)
  } finally {
    await payload.destroy()
  }
}

// `payload run` beendet den Prozess, sobald der Import des Skripts fertig ist – daher Top-Level-await.
try {
  await main()
  process.exit(0)
} catch (e: unknown) {
  const known =
    e instanceof SeedGuardError || e instanceof SeedDataError || e instanceof SeedTimeError
  console.error(known ? e.message : e instanceof Error ? (e.stack ?? e.message) : e)
  process.exit(1)
}
