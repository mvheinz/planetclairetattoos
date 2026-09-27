// Globales Setup der Int-Tests: Test-DB anlegen, leeren und migrieren (ARCHITEKTUR §7.2).
// `pnpm test:int` erledigt das schon vorher und setzt PC_DB_READY=1; direkte vitest-Aufrufe holen es hier nach.
// Danach wird der Datenbestand als Ausgangszustand gesichert, den jede Testdatei vorab wiederherstellt.
import { spawnSync } from 'node:child_process'

import 'dotenv/config'

import { captureBaseline } from './baseline'

export default async function setup(): Promise<void> {
  if (process.env.PC_DB_READY !== '1') {
    for (const args of [['db:ensure'], ['db:reset', '--test']]) {
      const res = spawnSync('pnpm', ['-s', ...args], { stdio: 'inherit' })
      if (res.status !== 0) throw new Error(`pnpm ${args.join(' ')} fehlgeschlagen`)
    }
  }
  const url = process.env.DATABASE_URL_TEST
  if (!url)
    throw new Error('DATABASE_URL_TEST fehlt – Int-Tests brauchen eine eigene Test-Datenbank.')
  await captureBaseline(url)
}
