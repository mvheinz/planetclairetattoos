// Globales Setup der Int-Tests: Test-DB anlegen, leeren und migrieren (ARCHITEKTUR §7.2).
// `pnpm test:int` erledigt das schon vorher und setzt PC_DB_READY=1; direkte vitest-Aufrufe holen es hier nach.
import { spawnSync } from 'node:child_process'

export default function setup(): void {
  if (process.env.PC_DB_READY === '1') return
  for (const args of [['db:ensure'], ['db:reset', '--test']]) {
    const res = spawnSync('pnpm', ['-s', ...args], { stdio: 'inherit' })
    if (res.status !== 0) throw new Error(`pnpm ${args.join(' ')} fehlgeschlagen`)
  }
}
