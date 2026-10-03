import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import type { CheckResult, StaticCheck } from './types'

// PLAN P1.32: `src/payload-types.ts` und die Import-Map sind committet und müssen dem erzeugten Stand entsprechen.
// Die Prüfung erzeugt beide neu und vergleicht; weicht etwas ab, bleibt der neue Stand liegen (zum Committen).
// DM-P1-06: Die erzeugten Typen enthalten kein `any`.

export const GENERATED_FILES = [
  { file: 'src/payload-types.ts', script: 'generate:types' },
  { file: 'src/app/(payload)/admin/importMap.js', script: 'generate:importmap' },
  // PLAN P6.21: Dienste-Daten aus der YAML in docs/recht/DIENSTE.md §7
  { file: 'src/lib/legal/services.generated.ts', script: 'legal:services' },
] as const

/** Zeilen mit dem Typ `any` (ohne Kommentare). */
export function findAnyTypes(source: string): number[] {
  const lines: number[] = []
  source.split('\n').forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '')
    if (/(:\s*any\b|<any\b|\bany\[\]|\|\s*any\b|\bas\s+any\b)/.test(code)) lines.push(i + 1)
  })
  return lines
}

export interface GeneratedSnapshot {
  file: string
  before: string | null
  after: string | null
  error?: string
  /** Erzeugendes Skript (für die Fehlermeldung). */
  script?: string
}

/** Bewertet die Schnappschüsse vor und nach dem Erzeugen. */
export function evaluateGenerated(snapshots: GeneratedSnapshot[]): CheckResult {
  const errors: string[] = []
  for (const s of snapshots) {
    if (s.error) {
      errors.push(`${s.file}: Erzeugen fehlgeschlagen – ${s.error}`)
      continue
    }
    if (s.after === null) {
      errors.push(`${s.file} fehlt nach dem Erzeugen.`)
      continue
    }
    if (s.before !== s.after) {
      errors.push(
        `${s.file} war nicht aktuell – neu erzeugt; bitte committen (${s.script ? `pnpm ${s.script}` : 'pnpm generate:types && pnpm generate:importmap'}).`,
      )
    }
    if (s.file.endsWith('payload-types.ts')) {
      const lines = findAnyTypes(s.after)
      if (lines.length > 0) {
        errors.push(`${s.file}: Typ \`any\` in Zeile ${lines.join(', ')} (DM-P1-06).`)
      }
    }
  }
  return { errors, warnings: [] }
}

const readOrNull = (abs: string): string | null => {
  try {
    return readFileSync(abs, 'utf8')
  } catch {
    return null
  }
}

export const generatedFilesCheck: StaticCheck = {
  name: 'generated-files',
  run(root) {
    const snapshots: GeneratedSnapshot[] = []
    for (const { file, script } of GENERATED_FILES) {
      const abs = path.join(root, file)
      const before = readOrNull(abs)
      const r = spawnSync('pnpm', ['run', '--silent', script], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      const error =
        r.status === 0
          ? undefined
          : (r.stderr || r.stdout || String(r.error ?? 'unbekannter Fehler')).trim().slice(-400)
      snapshots.push({ file, script, before, after: readOrNull(abs), error })
    }
    return evaluateGenerated(snapshots)
  },
}
