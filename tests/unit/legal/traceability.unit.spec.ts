import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

// R-001 (RECHT §4.1): Jede Anforderung mit Test-Art `unit`, `int` oder `e2e` ist durch mindestens einen automatisierten
// Test abgedeckt, dessen Titel die ID enthält. Quelle ist die Tabelle in docs/recht/ANFORDERUNGEN.md §3. Geprüft
// werden nur IDs, deren früheste Phase ≤ LEGAL_TRACE_PHASE ist; jede Phase erhöht den Wert auf ihre Nummer.

export const LEGAL_TRACE_PHASE = 3

const ROOT = path.resolve(__dirname, '../../..')
const AUTOMATED = new Set(['unit', 'int', 'e2e'])

export interface Requirement {
  id: string
  title: string
  earliestPhase: number
  tests: string[]
}

/** Zeilen `| R-### | Titel | Phase | Test | Owner |` aus §3. */
export function parseRequirementTable(markdown: string): Requirement[] {
  const start = markdown.indexOf('## 3. Übersicht aller Anforderungen')
  const end = markdown.indexOf('\n## 4.', start)
  if (start === -1) throw new Error('ANFORDERUNGEN §3 nicht gefunden')
  const out: Requirement[] = []
  for (const line of markdown.slice(start, end === -1 ? undefined : end).split('\n')) {
    if (!line.startsWith('| R-')) continue
    const cells = line.split('|').map((c) => c.trim())
    const [, id, title, phase, tests] = cells
    const phases = [...(phase ?? '').matchAll(/P(\d+)/g)].map((m) => Number(m[1]))
    if (!id || !/^R-\d{3}$/.test(id) || phases.length === 0) {
      throw new Error(`Ungültige Zeile in ANFORDERUNGEN §3: ${line}`)
    }
    out.push({
      id,
      title: title ?? '',
      earliestPhase: Math.min(...phases),
      tests: (tests ?? '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    })
  }
  return out
}

/** IDs, die bis `phase` durch automatisierte Tests abgedeckt sein müssen. */
export function requiredIds(requirements: Requirement[], phase: number): string[] {
  return requirements
    .filter((r) => r.earliestPhase <= phase && r.tests.some((t) => AUTOMATED.has(t)))
    .map((r) => r.id)
}

const TITLE_RE = /\b(?:test|it|describe)(?:\.\w+)*\(\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g

/** Titel aller `test(`/`it(`/`describe(`-Aufrufe einer Quelldatei. */
export function extractTestTitles(source: string): string[] {
  return [...source.matchAll(TITLE_RE)].map((m) => m[2]!)
}

/** R-IDs, die in keinem Testtitel vorkommen. */
export function missingIds(ids: string[], titles: string[]): string[] {
  const covered = new Set(titles.flatMap((t) => t.match(/R-\d{3}\b/g) ?? []))
  return ids.filter((id) => !covered.has(id))
}

function listTestFiles(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`
    if (statSync(path.join(ROOT, rel)).isDirectory()) return listTestFiles(rel)
    return /\.tsx?$/.test(name) ? [rel] : []
  })
}

const requirements = parseRequirementTable(
  readFileSync(path.join(ROOT, 'docs/recht/ANFORDERUNGEN.md'), 'utf8'),
)
const titles = listTestFiles('tests').flatMap((f) =>
  extractTestTitles(readFileSync(path.join(ROOT, f), 'utf8')),
)

describe('R-001 Nachverfolgbarkeit Anforderung ↔ Test', () => {
  it('R-001 Tabelle §3 ist lesbar und enthält die P1-Anforderungen', () => {
    expect(requirements.length).toBeGreaterThan(100)
    const p1 = requiredIds(requirements, 1)
    for (const id of ['R-001', 'R-012', 'R-032', 'R-041', 'R-048', 'R-135', 'R-136']) {
      expect(p1).toContain(id)
    }
    // Nur-manuelle Anforderungen zählen nicht (z. B. R-022, P11).
    expect(requiredIds(requirements, 11)).not.toContain('R-022')
  })

  it(`R-001 jede automatisiert geprüfte Anforderung bis Phase P${LEGAL_TRACE_PHASE} steht in einem Testtitel`, () => {
    expect(missingIds(requiredIds(requirements, LEGAL_TRACE_PHASE), titles)).toEqual([])
  })

  it('R-001 Phase 2 (P2.29): R-010, R-011, R-090, R-130, R-131, R-191 sind gefordert und stehen in Testtiteln', () => {
    const p2 = ['R-010', 'R-011', 'R-090', 'R-130', 'R-131', 'R-191']
    const required = requiredIds(requirements, 2)
    for (const id of p2) expect(required).toContain(id)
    expect(requiredIds(requirements, 1)).not.toContain('R-010')
    expect(missingIds(p2, titles)).toEqual([])
    // Gegenprobe mit einer P2-ID: fehlt sie in allen Titeln, ist R-001 rot.
    const without = titles.map((t) => t.replace(/R-131\b/g, 'R-xxx'))
    expect(missingIds(required, without)).toEqual(['R-131'])
  })

  it('R-001 Phase 3 (P3.16): Shop-Anforderungen sind gefordert bzw. stehen in Testtiteln', () => {
    const p3 = [
      'R-030',
      'R-031',
      'R-033',
      'R-035',
      'R-040',
      'R-043',
      'R-044',
      'R-045',
      'R-046',
      'R-047',
      'R-048',
      'R-049',
      'R-096',
      'R-126',
      'R-130',
      'R-139',
    ]
    const required = requiredIds(requirements, 3)
    for (const id of ['R-030', 'R-031', 'R-035', 'R-040', 'R-049', 'R-096', 'R-126', 'R-139'])
      expect(required).toContain(id)
    expect(requiredIds(requirements, 2)).not.toContain('R-139')
    expect(missingIds(p3, titles)).toEqual([])
    // Gegenprobe mit einer P3-ID: fehlt sie in allen Titeln, ist R-001 rot.
    const without = titles.map((t) => t.replace(/R-139\b/g, 'R-xxx'))
    expect(missingIds(required, without)).toEqual(['R-139'])
  })

  it('R-001 Gegenprobe: eine aus den Titeln entfernte ID ergibt rot', () => {
    const ids = requiredIds(requirements, LEGAL_TRACE_PHASE)
    const without = titles.map((t) => t.replace(/R-048\b/g, 'R-xxx'))
    expect(missingIds(ids, without)).toEqual(['R-048'])
    expect(
      extractTestTitles(`it('R-777 a', () => {}); test.describe("R-778 b", () => {})`),
    ).toEqual(['R-777 a', 'R-778 b'])
  })
})
