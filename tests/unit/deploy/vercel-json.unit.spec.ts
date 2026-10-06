import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { shouldSkipBuild } from '../../../scripts/vercel-ignore-build.mjs'

// P10.13 – `vercel.json` (ARCHITEKTUR §12, §9.6, §10.3): Schema-Prüfung, Crons zeigen auf vorhandene Routen, die ohne
// Freigabe 404 bzw. ohne Bearer 401 liefern; Ignored-Build-Step.

const root = path.resolve(__dirname, '../../..')
const vercel = JSON.parse(readFileSync(path.join(root, 'vercel.json'), 'utf8')) as unknown

// Ausschnitt des Vercel-Schemas (https://openapi.vercel.sh/vercel.json), streng: unbekannte Schlüssel sind Fehler.
const CRON = /^(\S+\s){4}\S+$/
const Schema = z
  .object({
    $schema: z.string().url(),
    regions: z.array(z.string().regex(/^[a-z]{3}\d$/)).min(1),
    crons: z.array(
      z.object({ path: z.string().startsWith('/'), schedule: z.string().regex(CRON) }).strict(),
    ),
    ignoreCommand: z.string().min(1),
  })
  .strict()

describe('vercel.json', () => {
  it('entspricht dem Schema; Region fra1', () => {
    const parsed = Schema.parse(vercel)
    expect(parsed.regions).toEqual(['fra1'])
  })

  it('Crons: Tick jede Minute, Backup 01:30 UTC; Routen existieren und sind geschützt', () => {
    const { crons } = Schema.parse(vercel)
    expect(crons).toEqual([
      { path: '/api/cron/tick', schedule: '* * * * *' },
      { path: '/api/cron/backup', schedule: '30 1 * * *' },
    ])
    for (const c of crons) {
      const file = path.join(root, 'src/app/(api)', c.path, 'route.ts')
      const src = readFileSync(file, 'utf8')
      expect(src).toContain('export')
      expect(src).toMatch(/GET/)
    }
    // Das Backup-Gerüst verlangt Freigabe (404) und Bearer (401): Verhalten in tests/int/backup/cron-route.int.spec.ts.
    expect(readFileSync(path.join(root, 'src/lib/backup/cron.ts'), 'utf8')).toContain('not_found')
  })

  it('Ignored Build Step: nur docs/tests/content-art → überspringen, sonst bauen', () => {
    expect(shouldSkipBuild(['docs/RUNBOOK.md', 'tests/unit/a.spec.ts', 'content/art/x.svg'])).toBe(
      true,
    )
    expect(shouldSkipBuild(['docs/RUNBOOK.md', 'src/app/page.tsx'])).toBe(false)
    expect(shouldSkipBuild([])).toBe(false)
    expect(shouldSkipBuild(['content/seed/a.json'])).toBe(false)
    expect(shouldSkipBuild(['package.json'])).toBe(false)
    expect(vercel).toMatchObject({ ignoreCommand: 'node scripts/vercel-ignore-build.mjs' })
  })
})
