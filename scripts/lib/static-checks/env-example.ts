import { ENV_VARS, renderEnvExample } from '../../../src/lib/env.schema'
import { readText } from './files'
import type { CheckResult, StaticCheck } from './types'

/** Namen aus den Tabellen von ARCHITEKTUR §5.2 (erste Spalte, in Backticks). */
export function parseEnvTableNames(markdown: string): Set<string> {
  const start = markdown.indexOf('### 5.2 Tabelle')
  const end = markdown.indexOf('### 5.3', start)
  const section = markdown.slice(start, end === -1 ? undefined : end)
  const names = new Set<string>()
  for (const line of section.split('\n')) {
    const m = /^\|\s*`([A-Z0-9_]+)`\s*\|/.exec(line)
    if (m?.[1]) names.add(m[1])
  }
  return names
}

/** AK-A-5-01: .env.example = generierter Stand, jede Schema-Variable steht in §5.2. */
export function checkEnvExample(example: string, architektur: string): CheckResult {
  const errors: string[] = []
  if (example !== renderEnvExample()) {
    errors.push('.env.example weicht vom generierten Stand ab – `pnpm env:example` ausführen.')
  }
  const table = parseEnvTableNames(architektur)
  for (const v of ENV_VARS) {
    if (!table.has(v.name))
      errors.push(`${v.name} steht im Schema, fehlt aber in ARCHITEKTUR §5.2.`)
  }
  return { errors, warnings: [] }
}

export const envExampleCheck: StaticCheck = {
  name: 'env-example',
  run: (root) =>
    checkEnvExample(readText(root, '.env.example'), readText(root, 'docs/ARCHITEKTUR.md')),
}
