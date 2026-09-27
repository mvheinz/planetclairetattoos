// Statische Prüfungen (ARCHITEKTUR §6.3 Schritt 4). Aufruf: pnpm check:static [--only=name,name]
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { envExampleCheck } from './lib/static-checks/env-example'
import { externalUrlsCheck } from './lib/static-checks/external-urls'
import { generatedFilesCheck } from './lib/static-checks/generated'
import { importRulesCheck } from './lib/static-checks/import-rules'
import { stripeImportCheck } from './lib/static-checks/stripe-import'
import type { StaticCheck } from './lib/static-checks/types'
import { versionsCheck } from './lib/static-checks/versions'

/** Registrierte Teilprüfungen; spätere Phasen hängen ihre hier an (i18n-parity, route-registry ab P2.1). */
export const CHECKS: StaticCheck[] = [
  versionsCheck,
  envExampleCheck,
  importRulesCheck,
  stripeImportCheck,
  externalUrlsCheck,
  generatedFilesCheck,
]

async function main(): Promise<void> {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const only = process.argv
    .find((a) => a.startsWith('--only='))
    ?.slice(7)
    .split(',')
  let failed = 0
  for (const check of CHECKS) {
    if (only && !only.includes(check.name)) continue
    const r = await check.run(root, new Date())
    for (const w of r.warnings) console.warn(`[${check.name}] Warnung: ${w}`)
    for (const e of r.errors) console.error(`[${check.name}] ${e}`)
    console.log(`${r.errors.length ? '✗' : '✓'} ${check.name}`)
    if (r.errors.length) failed++
  }
  if (failed) process.exit(1)
}

void main()
