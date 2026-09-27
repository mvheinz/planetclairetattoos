import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  ARTIFACTS_ENDPOINT,
  runArtifactBudget,
  type BudgetIo,
} from '../../../scripts/ci/artifact-budget'
import type { GhApiPages } from '../../../scripts/ci/gh'

// AK-A-6-02 (Budget-Teil, ARCHITEKTUR §6.2): `pnpm ci:artifacts` mit aufgezeichneten API-Antworten, ohne Netz.

const fixture = (name: string): unknown[] =>
  JSON.parse(readFileSync(path.resolve('tests/fixtures/github', name), 'utf8')) as unknown[]

function fakeIo() {
  const files: Record<string, string> = {}
  const log: string[] = []
  const io: BudgetIo = {
    env: { GITHUB_OUTPUT: '/out', GITHUB_STEP_SUMMARY: '/summary' },
    append: (f, t) => {
      files[f] = (files[f] ?? '') + t
    },
    log: (l) => log.push(l),
  }
  return { io, files, log }
}

const pagesFrom =
  (pages: unknown[]): GhApiPages =>
  async (endpoint) => {
    expect(endpoint).toBe(ARTIFACTS_ENDPOINT)
    return pages
  }

describe('AK-A-6-02 Budget-Schritt pnpm ci:artifacts', () => {
  it('AK-A-6-02 349 MB nicht abgelaufene Artefakte → upload_optional=true', async () => {
    const { io, files } = fakeIo()
    const r = await runArtifactBudget(pagesFrom(fixture('artifacts-349mb.json')), io)
    expect(r.totalBytes).toBe(349_000_000) // das abgelaufene Artefakt zählt nicht
    expect(files['/out']).toBe('upload_optional=true\n')
    expect(files['/summary']).toMatch(/349,0\/500 MB/)
  })

  it('AK-A-6-02 350 MB → upload_optional=false mit Grund im Job-Summary', async () => {
    const { io, files } = fakeIo()
    const r = await runArtifactBudget(pagesFrom(fixture('artifacts-350mb.json')), io)
    expect(r.uploadOptional).toBe(false)
    expect(files['/out']).toBe('upload_optional=false\n')
    expect(files['/summary']).toBe(
      'Fehlerbericht nicht hochgeladen – Artefakt-Speicher fast voll (350,0/500 MB).\n',
    )
  })

  it('AK-A-6-02 API-Fehler → upload_optional=false, kein Wurf', async () => {
    const { io, files } = fakeIo()
    const failing: GhApiPages = () => Promise.reject(new Error('HTTP 403: Resource not accessible'))
    const r = await runArtifactBudget(failing, io)
    expect(r.uploadOptional).toBe(false)
    expect(files['/out']).toBe('upload_optional=false\n')
    expect(files['/summary']).toMatch(/nicht abrufbar \(HTTP 403/)
  })

  it('AK-A-6-02 unerwartete Antwort und nicht beschreibbare Ausgabe → false, kein Wurf', async () => {
    const { log } = fakeIo()
    const io: BudgetIo = {
      env: { GITHUB_OUTPUT: '/out' },
      append: () => {
        throw new Error('EACCES')
      },
      log: (l) => log.push(l),
    }
    const r = await runArtifactBudget(pagesFrom([{ message: 'Not Found' }]), io)
    expect(r.uploadOptional).toBe(false)
    expect(log).toContain('upload_optional=false')
  })

  it('AK-A-6-02 das Skript endet immer mit Exit 0', () => {
    const src = readFileSync(path.resolve('scripts/ci/artifact-budget.ts'), 'utf8')
    expect(src).toMatch(/finally\(\(\) => process\.exit\(0\)\)/)
    expect(src).not.toMatch(/process\.exit\(1\)/)
  })
})
