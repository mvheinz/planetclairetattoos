import { listFiles, readText } from './files'
import type { CheckResult, StaticCheck } from './types'

// ARCHITEKTUR §2.2: serverseitige Module beginnen mit `import 'server-only'`.
export const SERVER_ONLY_DIRS = [
  'commerce',
  'payments',
  'carrier',
  'email',
  'storage',
  'translation',
  'pdf',
  'invoices',
  'legal',
  'seed',
  'retention',
  'db',
  'export',
  'jobs',
  'backup',
  'security',
].map((d) => `src/lib/${d}`)
export const SERVER_ONLY_FILES = ['src/lib/env.ts', 'src/lib/audit.ts']

const FIRST_IMPORT = /^\s*import\s[^\n]*$/m

export function startsWithServerOnly(source: string): boolean {
  const m = FIRST_IMPORT.exec(source)
  return !!m && /^\s*import\s+['"]server-only['"]/.test(m[0])
}

export function checkImportRules(files: { path: string; source: string }[]): CheckResult {
  const errors: string[] = []
  for (const f of files) {
    const serverOnly =
      SERVER_ONLY_FILES.includes(f.path) || SERVER_ONLY_DIRS.some((d) => f.path.startsWith(`${d}/`))
    if (serverOnly && /\.(ts|tsx)$/.test(f.path) && !startsWithServerOnly(f.source)) {
      errors.push(
        `${f.path}: serverseitiges Modul muss mit import 'server-only' beginnen (ARCHITEKTUR §2.2).`,
      )
    }
    if (f.path.startsWith('src/app/(frontend)/') && /\bgetPayload\b/.test(f.source)) {
      errors.push(
        `${f.path}: öffentliche Seiten lesen nur über src/lib/data/* (kein getPayload, ARCHITEKTUR §2.2).`,
      )
    }
  }
  return { errors, warnings: [] }
}

export const importRulesCheck: StaticCheck = {
  name: 'import-rules',
  run: (root) =>
    checkImportRules(listFiles(root, 'src').map((p) => ({ path: p, source: readText(root, p) }))),
}
