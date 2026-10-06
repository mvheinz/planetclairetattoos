// Markiert die Datenbank als Produktion (ARCHITEKTUR §4.8, PLAN P10.13): einmalig in P11, nach dem Grund-Seed.
// Aufruf: pnpm db:mark-production [--yes]. Setzt `COMMENT ON DATABASE <name> IS 'planetclaire:production'` über
// `DATABASE_URL_UNPOOLED` (sonst `DATABASE_URL`). Danach brechen Seed, Reset und Test-Setups gegen diese Datenbank ab.
// Ohne `--yes` wird nur gezeigt, was passieren würde.
import 'dotenv/config'

import {
  databaseNameFromUrl,
  isProductionDatabase,
  PRODUCTION_DB_COMMENT,
} from '../src/lib/db/guard'

import { devUrl, withClient } from './lib/pg'

export async function markProduction(
  client: Parameters<typeof isProductionDatabase>[0] & { query: (sql: string) => Promise<unknown> },
  databaseName: string,
): Promise<'marked' | 'already'> {
  if (await isProductionDatabase(client)) return 'already'
  const quoted = `"${databaseName.replace(/"/g, '""')}"`
  await client.query(`COMMENT ON DATABASE ${quoted} IS '${PRODUCTION_DB_COMMENT}'`)
  return 'marked'
}

async function main(): Promise<void> {
  const url = devUrl()
  if (!url) throw new Error('DATABASE_URL(_UNPOOLED) fehlt.')
  const name = databaseNameFromUrl(url)
  const yes = process.argv.slice(2).includes('--yes')
  const unknown = process.argv.slice(2).filter((a) => a !== '--yes')
  if (unknown.length) throw new Error(`Unbekannte Option: ${unknown.join(', ')}`)
  if (!yes) {
    console.log(
      `db:mark-production: Datenbank „${name}“ würde als Produktion markiert. Zum Ausführen: --yes`,
    )
    return
  }
  const result = await withClient(url, (c) => markProduction(c, name))
  console.log(
    result === 'already'
      ? `db:mark-production: „${name}“ ist schon als Produktion markiert.`
      : `db:mark-production: „${name}“ ist jetzt als Produktion markiert.`,
  )
}

if (process.argv[1]?.endsWith('db-mark-production.ts')) {
  main().then(
    () => process.exit(0),
    (e: unknown) => {
      console.error(e instanceof Error ? e.message : e)
      process.exit(1)
    },
  )
}
