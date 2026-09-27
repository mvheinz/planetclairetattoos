// Setzt die Test-Datenbank zurück (ARCHITEKTUR §4.8, §7.2). Aufruf: pnpm db:reset --test
// Nur bei DB-Name auf _test, APP_ENV ≠ production und ohne Produktions-Markierung.
import { spawnSync } from 'node:child_process'

import {
  databaseNameFromUrl,
  destructiveActionBlockedReason,
  isProductionDatabase,
} from '../src/lib/db/guard'
import { testUrl, withClient } from './lib/pg'

export async function resetTestDatabase(url: string, appEnv: string): Promise<void> {
  const databaseName = databaseNameFromUrl(url)
  await withClient(url, async (c) => {
    const reason = destructiveActionBlockedReason({
      appEnv,
      databaseName,
      isProductionMarked: await isProductionDatabase(c),
      requireTestSuffix: true,
    })
    if (reason) throw new Error(reason)
    await c.query('DROP SCHEMA IF EXISTS public CASCADE')
    await c.query('DROP SCHEMA IF EXISTS payload CASCADE')
    await c.query('CREATE SCHEMA public')
  })
}

export function runMigrations(url: string): void {
  const res = spawnSync('pnpm', ['-s', 'payload', 'migrate'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: url,
      DATABASE_URL_UNPOOLED: url,
      PAYLOAD_DB_PUSH: 'false',
    },
  })
  if (res.status !== 0) throw new Error('payload migrate fehlgeschlagen')
}

async function main(): Promise<void> {
  if (!process.argv.includes('--test'))
    throw new Error('db:reset erwartet --test (nur die Test-Datenbank wird geleert).')
  const url = testUrl()
  if (!url) throw new Error('DATABASE_URL_TEST fehlt.')
  await resetTestDatabase(url, process.env.APP_ENV ?? 'development')
  runMigrations(url)
  console.log(`db:reset: ${databaseNameFromUrl(url)} zurückgesetzt und migriert`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
}
