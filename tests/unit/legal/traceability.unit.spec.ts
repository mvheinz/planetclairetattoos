import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

// R-001 (RECHT §4.1): Jede Anforderung mit Test-Art `unit`, `int` oder `e2e` ist durch mindestens einen automatisierten
// Test abgedeckt, dessen Titel die ID enthält. Quelle ist die Tabelle in docs/recht/ANFORDERUNGEN.md §3. Geprüft
// werden nur IDs, deren früheste Phase ≤ LEGAL_TRACE_PHASE ist; jede Phase erhöht den Wert auf ihre Nummer. Seit P6.23
// liest der Parser die Spalten über die Kopfzeile (`| ID | Titel | Phase | Test | Owner | Nachweis |`); jede Zeile bis
// zur aktuellen Phase nennt in „Nachweis“ Testdateien (die existieren müssen) bzw. „§7“ für manuelle Punkte (EK-06).

export const LEGAL_TRACE_PHASE = 10

const ROOT = path.resolve(__dirname, '../../..')
const AUTOMATED = new Set(['unit', 'int', 'e2e'])

export interface Requirement {
  id: string
  title: string
  earliestPhase: number
  tests: string[]
  /** Spalte „Nachweis“: Testdatei-Pfade, `§7` (manuell) oder leer/„–“ (spätere Phase). */
  evidence: string[]
}

const COLUMNS = {
  id: 'ID',
  title: 'Titel',
  phase: 'Phase',
  tests: 'Test',
  evidence: 'Nachweis',
} as const

const cellsOf = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())

/** Zeilen der Tabelle §3; Spalten über die Kopfzeile (Reihenfolge egal, „Nachweis“ optional für ältere Fassungen). */
export function parseRequirementTable(markdown: string): Requirement[] {
  const start = markdown.indexOf('## 3. Übersicht aller Anforderungen')
  const end = markdown.indexOf('\n## 4.', start)
  if (start === -1) throw new Error('ANFORDERUNGEN §3 nicht gefunden')
  const lines = markdown.slice(start, end === -1 ? undefined : end).split('\n')
  const header = lines.find((l) => /^\|\s*ID\s*\|/.test(l))
  if (!header) throw new Error('ANFORDERUNGEN §3: Kopfzeile fehlt')
  const names = cellsOf(header)
  const col = (name: string) => names.indexOf(name)
  for (const name of [COLUMNS.id, COLUMNS.title, COLUMNS.phase, COLUMNS.tests]) {
    if (col(name) === -1) throw new Error(`ANFORDERUNGEN §3: Spalte „${name}“ fehlt`)
  }
  const out: Requirement[] = []
  for (const line of lines) {
    if (!line.startsWith('| R-')) continue
    const cells = cellsOf(line)
    const get = (name: string) => (col(name) === -1 ? '' : (cells[col(name)] ?? ''))
    const id = get(COLUMNS.id)
    const phases = [...get(COLUMNS.phase).matchAll(/P(\d+)/g)].map((m) => Number(m[1]))
    if (!/^R-\d{3}$/.test(id) || phases.length === 0 || cells.length !== names.length) {
      throw new Error(`Ungültige Zeile in ANFORDERUNGEN §3: ${line}`)
    }
    out.push({
      id,
      title: get(COLUMNS.title),
      earliestPhase: Math.min(...phases),
      tests: get(COLUMNS.tests)
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      evidence: get(COLUMNS.evidence)
        .split(',')
        .map((t) => t.trim().replace(/^`|`$/g, ''))
        .filter((t) => t !== '' && t !== '–'),
    })
  }
  return out
}

/** Zeilen bis `phase` ohne Nachweis (EK-06). */
export function missingEvidence(requirements: Requirement[], phase: number): string[] {
  return requirements
    .filter((r) => r.earliestPhase <= phase && r.evidence.length === 0)
    .map((r) => r.id)
}

/** Genannte Nachweis-Pfade, die es nicht gibt (`§7` = manuell, ANFORDERUNGEN §7). */
export function missingEvidencePaths(
  requirements: Requirement[],
  exists: (rel: string) => boolean,
): string[] {
  return requirements.flatMap((r) =>
    r.evidence.filter((e) => e !== '§7' && !exists(e)).map((e) => `${r.id}: ${e}`),
  )
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

const markdown = readFileSync(path.join(ROOT, 'docs/recht/ANFORDERUNGEN.md'), 'utf8')
const requirements = parseRequirementTable(markdown)
const fileExists = (rel: string) => existsSync(path.join(ROOT, rel))
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

  it('R-001 Phase 4 (P4.25): Kassen-, Zahlungs- und Mail-Anforderungen stehen in Testtiteln', () => {
    const p4 = [
      'R-013',
      'R-031',
      'R-035',
      'R-036',
      'R-048',
      'R-060',
      'R-061',
      'R-062',
      'R-063',
      'R-064',
      'R-065',
      'R-066',
      'R-067',
      'R-070',
      'R-071',
      'R-080',
      'R-081',
      'R-084',
      'R-101',
      'R-102',
      'R-120',
      'R-121',
      'R-126',
      'R-130',
      'R-137',
      'R-138',
    ]
    expect(missingIds(p4, titles)).toEqual([])
    const required = requiredIds(requirements, 4)
    for (const id of ['R-060', 'R-064', 'R-066', 'R-080', 'R-101', 'R-102', 'R-137'])
      expect(required).toContain(id)
    // Gegenprobe mit einer P4-ID: fehlt sie in allen Titeln, ist R-001 rot.
    const without = titles.map((t) => t.replace(/R-102\b/g, 'R-xxx'))
    expect(missingIds(required, without)).toEqual(['R-102'])
  })

  it('R-001 Gegenprobe: eine aus den Titeln entfernte ID ergibt rot', () => {
    const ids = requiredIds(requirements, LEGAL_TRACE_PHASE)
    const without = titles.map((t) => t.replace(/R-048\b/g, 'R-xxx'))
    expect(missingIds(ids, without)).toEqual(['R-048'])
    expect(
      extractTestTitles(`it('R-777 a', () => {}); test.describe("R-778 b", () => {})`),
    ).toEqual(['R-777 a', 'R-778 b'])
  })

  it('R-001 Phase 6 (P6.23): Rechts-, Widerrufs- und Datenschutz-Anforderungen stehen in Testtiteln', () => {
    const p6 = [
      'R-002',
      'R-014',
      'R-090',
      'R-091',
      'R-092',
      'R-093',
      'R-094',
      'R-095',
      'R-110',
      'R-111',
      'R-112',
      'R-150',
      'R-151',
      'R-152',
      'R-153',
      'R-154',
      'R-155',
    ]
    const required = requiredIds(requirements, 6)
    for (const id of ['R-002', 'R-150', 'R-151', 'R-152', 'R-153']) expect(required).toContain(id)
    expect(requiredIds(requirements, 5)).not.toContain('R-153')
    expect(missingIds(p6, titles)).toEqual([])
    // Gegenprobe mit einer P6-ID: fehlt sie in allen Titeln, ist R-001 rot.
    const without = titles.map((t) => t.replace(/R-153\b/g, 'R-xxx'))
    expect(missingIds(required, without)).toEqual(['R-153'])
  })

  it('R-001 Phase 7 (P7.15): Tattoo- und Auftragsarbeiten-Anforderungen stehen in Testtiteln', () => {
    const p7 = ['R-034', 'R-134', 'R-135', 'R-138', 'R-160', 'R-170', 'R-171', 'R-172']
    const required = requiredIds(requirements, 7)
    for (const id of ['R-034', 'R-160', 'R-170', 'R-171', 'R-172']) expect(required).toContain(id)
    expect(requiredIds(requirements, 6)).not.toContain('R-170')
    // R-161 ist manuell (ANFORDERUNGEN §7 Teil A) und zählt nicht
    expect(required).not.toContain('R-161')
    expect(missingIds(p7, titles)).toEqual([])
    // Gegenprobe mit einer P7-ID: fehlt sie in allen Titeln, ist R-001 rot.
    const without = titles.map((t) => t.replace(/R-170\b/g, 'R-xxx'))
    expect(missingIds(required, without)).toEqual(['R-170'])
  })

  it('R-001 Phase 8 (Phasen-Abnahme P8): Beispielbestand-Anforderungen stehen in Testtiteln', () => {
    const p8 = ['R-180', 'R-181']
    const required = requiredIds(requirements, 8)
    for (const id of p8) expect(required).toContain(id)
    expect(requiredIds(requirements, 7)).not.toContain('R-180')
    expect(missingIds(p8, titles)).toEqual([])
    // Gegenprobe mit einer P8-ID: fehlt sie in allen Titeln, ist R-001 rot.
    const without = titles.map((t) => t.replace(/R-181\b/g, 'R-xxx'))
    expect(missingIds(required, without)).toEqual(['R-181'])
  })

  it('R-001 Phase 10 (P10.1): Überwachungs-, Vorschau- und Go-live-Anforderungen stehen in Testtiteln', () => {
    const p10 = ['R-132', 'R-133', 'R-155', 'R-182', 'R-200', 'R-210']
    const required = requiredIds(requirements, 10)
    for (const id of p10) expect(required).toContain(id)
    // Rein manuelle Anforderungen (R-157, R-190) zählen nicht
    for (const id of ['R-157', 'R-190']) expect(required).not.toContain(id)
    expect(missingIds(p10, titles)).toEqual([])
    // Gegenprobe mit einer P10-ID: fehlt sie in allen Titeln, ist R-001 rot.
    const without = titles.map((t) => t.replace(/R-133\b/g, 'R-xxx'))
    expect(missingIds(required, without)).toEqual(['R-133'])
  })

  it(`R-001 EK-06 jede Anforderung bis Phase P${LEGAL_TRACE_PHASE} hat einen Nachweis, jeder genannte Pfad existiert`, () => {
    expect(missingEvidence(requirements, LEGAL_TRACE_PHASE)).toEqual([])
    expect(missingEvidencePaths(requirements, fileExists)).toEqual([])
  })

  it('R-001 Gegenprobe Nachweis: umbenannter Pfad bzw. fehlender Nachweis ergibt rot', () => {
    const renamed = markdown.replace(
      '`tests/unit/legal/gdpr-deadline.unit.spec.ts`',
      '`tests/unit/legal/gdpr-deadline-umbenannt.unit.spec.ts`',
    )
    expect(renamed).not.toBe(markdown)
    expect(missingEvidencePaths(parseRequirementTable(renamed), fileExists)).toEqual([
      'R-153: tests/unit/legal/gdpr-deadline-umbenannt.unit.spec.ts',
    ])
    const emptied = markdown.replace(/^(\| R-153 \|(?:[^|]*\|){4})[^|]*\|$/m, '$1 – |')
    expect(missingEvidence(parseRequirementTable(emptied), LEGAL_TRACE_PHASE)).toEqual(['R-153'])
    // Kopfzeile bestimmt die Spalten: Tabelle mit vertauschten Spalten „Test“/„Owner“
    const reordered = [
      '## 3. Übersicht aller Anforderungen',
      '| ID | Titel | Phase | Owner | Test | Nachweis |',
      '|---|---|---|---|---|---|',
      '| R-999 | Beispiel | P6 | nein | unit | `tests/unit/legal/traceability.unit.spec.ts` |',
      '',
      '## 4. Ende',
    ].join('\n')
    expect(parseRequirementTable(reordered)).toEqual([
      {
        id: 'R-999',
        title: 'Beispiel',
        earliestPhase: 6,
        tests: ['unit'],
        evidence: ['tests/unit/legal/traceability.unit.spec.ts'],
      },
    ])
  })
})
