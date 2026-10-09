// Prüfschleuse (U-65): legt die Datenbank aus DATABASE_URL frisch an – wie der frische Postgres-Dienst je GitHub-Job.
// Der Beispielbestand ist idempotent und lässt Reservierungen/Verkäufe früherer Läufe stehen (P14.14: 901/911 blieben
// reserviert, `check:bundle` konnte den Korb nicht füllen). Nur für Datenbanken der Prüfschleuse (`planetclaire_ci…`).
import { databaseNameFromUrl } from '../../src/lib/db/guard'
import { devUrl, withClient, withDatabase } from '../lib/pg'

async function main(): Promise<void> {
  const url = devUrl()
  const name = databaseNameFromUrl(url)
  if (!/^planetclaire_ci[a-z0-9_]*$/.test(name))
    throw new Error(`fresh-db: nur Datenbanken der Prüfschleuse (planetclaire_ci…), nicht ${name}`)
  if (process.env.APP_ENV === 'production') throw new Error('fresh-db: nie mit APP_ENV=production')
  await withClient(withDatabase(url, 'postgres'), async (c) => {
    await c.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
    await c.query(`CREATE DATABASE "${name}"`)
  })
  console.log(`fresh-db: ${name} neu angelegt`)
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
