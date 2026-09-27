// Legt die Datenbanken aus DATABASE_URL und DATABASE_URL_TEST an, falls sie fehlen (ARCHITEKTUR §4.4). Aufruf: pnpm db:ensure
import { databaseNameFromUrl } from '../src/lib/db/guard'
import { devUrl, testUrl, withClient, withDatabase } from './lib/pg'

async function ensure(url: string): Promise<void> {
  const name = databaseNameFromUrl(url)
  await withClient(withDatabase(url, 'postgres'), async (c) => {
    const exists = await c.query('SELECT 1 FROM pg_database WHERE datname = $1', [name])
    if (exists.rowCount) return
    // Identifier nicht parametrierbar: Name streng prüfen, dann quoten.
    if (!/^[a-z0-9_]+$/.test(name)) throw new Error(`Ungültiger Datenbankname: ${name}`)
    await c.query(`CREATE DATABASE "${name}"`)
    console.log(`Datenbank ${name} angelegt`)
  })
}

async function main(): Promise<void> {
  const urls = [...new Set([devUrl(), testUrl()].filter(Boolean))]
  for (const url of urls) await ensure(url)
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
