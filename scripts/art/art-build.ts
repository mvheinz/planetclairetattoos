import { spawnSync } from 'node:child_process'

import { ART_DIST_DIR } from './lib/run'

// `pnpm art:build` (KUNST-QA §3.3, §4.1, PLAN P9.2): Produktions-Build für die Kunst-Abnahme mit
// `NEXT_PUBLIC_LEASH_DEBUG=1` (Test-Schnittstellen `__leash`/`__qa`) und `ART_QA=1` (QA-Seiten, Query-Schalter) gegen
// die Datenbank aus `DATABASE_URL` (vorher `pnpm payload migrate` + `pnpm seed`, `SEED_NOW` wie CI). Eigenes
// Build-Verzeichnis `.next-art` (`ART_DIST_DIR`), damit der reguläre Build (`.next`, `check:no-debug`) unberührt bleibt.
// Nie in Produktion (`APP_ENV=production` bricht ab; der Start mit `ART_QA` ebenfalls, `collectEnvViolations`).

function main(): void {
  if (process.env.APP_ENV === 'production') {
    console.error(
      'art:build: APP_ENV=production – der QA-Build ist nur außerhalb von Produktion erlaubt.',
    )
    process.exit(1)
  }
  const env = {
    ...process.env,
    NEXT_PUBLIC_LEASH_DEBUG: '1',
    ART_QA: '1',
    NEXT_DIST_DIR: process.env.ART_DIST_DIR || ART_DIST_DIR,
    NEXT_TELEMETRY_DISABLED: '1',
  }
  console.log(`art:build: next build → ${env.NEXT_DIST_DIR} (NEXT_PUBLIC_LEASH_DEBUG=1, ART_QA=1)`)
  const res = spawnSync('pnpm', ['run', 'build'], { stdio: 'inherit', env })
  process.exit(res.status ?? 1)
}

main()
