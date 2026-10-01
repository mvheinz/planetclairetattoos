import path from 'path'
import { ESLint } from 'eslint'
import { beforeAll, describe, expect, it } from 'vitest'

// AK-A-15-01: Werkzeugregeln aus ARCHITEKTUR §15 greifen (virtuelle Dateien, keine absichtlich fehlerhaften Dateien im Repo).
const root = path.resolve(import.meta.dirname, '../../..')
let eslint: ESLint

async function ruleIds(code: string, file: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: path.join(root, file) })
  return (result?.messages ?? []).map((m) => m.ruleId ?? 'parse')
}

describe('ESLint-Regeln (ARCHITEKTUR §15)', () => {
  // Der erste `lintText` lädt Konfiguration, Plugins und TypeScript-Parser (unter Coverage-Instrumentierung > 5 s) –
  // das gehört in die Vorbereitung mit eigener Zeitgrenze, nicht in den ersten Test.
  beforeAll(async () => {
    eslint = new ESLint({ cwd: root })
    await ruleIds('export {}\n', 'src/lib/example.ts')
  }, 120_000)

  it('AK-A-15-01 console.log in src/ ist ein Fehler', async () => {
    expect(await ruleIds("console.log('x')\n", 'src/lib/example.ts')).toContain('no-console')
  })

  it('AK-A-15-01 Logger darf console nutzen', async () => {
    expect(await ruleIds("console.log('x')\n", 'src/lib/monitoring/logger.ts')).not.toContain(
      'no-console',
    )
  })

  it('AK-A-15-01 new Date() in src/lib/commerce/ ist ein Fehler, new Date(x) nicht', async () => {
    expect(await ruleIds('export const d = new Date()\n', 'src/lib/commerce/x.ts')).toContain(
      'no-restricted-syntax',
    )
    expect(
      await ruleIds('export const d = (s: string) => new Date(s)\n', 'src/lib/commerce/x.ts'),
    ).not.toContain('no-restricted-syntax')
  })

  it('AK-A-15-01 Date.now() in src/jobs/ ist ein Fehler', async () => {
    expect(await ruleIds('export const t = Date.now()\n', 'src/jobs/x.ts')).toContain(
      'no-restricted-syntax',
    )
  })

  it('AK-A-15-01 toFixed in src/lib/commerce/ ist ein Fehler', async () => {
    expect(
      await ruleIds('export const s = (n: number) => n.toFixed(2)\n', 'src/lib/commerce/x.ts'),
    ).toContain('no-restricted-syntax')
  })

  it('AK-A-15-01 any in handgeschriebenem Code ist ein Fehler', async () => {
    expect(await ruleIds('export const f = (x: any) => x\n', 'src/lib/example.ts')).toContain(
      '@typescript-eslint/no-explicit-any',
    )
  })

  it('AK-A-15-01 react-Import in src/behaviors/ ist ein Fehler', async () => {
    const ids = await ruleIds(
      "import { useState } from 'react'\nexport const x = useState\n",
      'src/behaviors/x.ts',
    )
    expect(ids).toContain('no-restricted-imports')
  })

  it('AK-A-5-02 process.env außerhalb von src/lib/env.ts ist ein Fehler', async () => {
    expect(await ruleIds('export const x = process.env.X\n', 'src/lib/foo.ts')).toContain(
      'no-restricted-properties',
    )
    expect(await ruleIds('export const x = process.env.X\n', 'src/lib/env.ts')).not.toContain(
      'no-restricted-properties',
    )
  })
})
