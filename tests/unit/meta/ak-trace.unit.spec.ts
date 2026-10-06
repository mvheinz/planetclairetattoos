import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  allTestTitles,
  collectIds,
  extractTestTitles,
  idsInTitle,
  listTestFiles,
  readRel,
  ROOT,
} from './trace-helpers'

// P10.1 (ARCHITEKTUR §7.2, KONZEPT §1.4): Jede Akzeptanz-ID aus KONZEPT (`AK-…`, `EK-…`), DATENMODELL (`DM-…`),
// ARCHITEKTUR (`AK-A-…`, `T-01…T-22`), DESIGN (`AK-DS-…`) und SEED-SPEC (`AK-SEED-…`) steht in einem Testtitel – oder
// in `tests/manual-checks.json` mit Begründung und Phase. Die Rechtsanforderungen R-xxx prüft
// `tests/unit/legal/traceability.unit.spec.ts` (R-001).

interface ManualCheck {
  id: string
  phase: string
  reason: string
}

const manual = (
  JSON.parse(readFileSync(path.join(ROOT, 'tests/manual-checks.json'), 'utf8')) as {
    checks: ManualCheck[]
  }
).checks

const ids = collectIds(readRel)
const titles = allTestTitles()

/** IDs ohne Testtitel und ohne Eintrag in manual-checks.json. */
export function untraced(
  all: Iterable<string>,
  testTitles: string[],
  manualIds: Iterable<string>,
): string[] {
  const covered = new Set([...testTitles.flatMap(idsInTitle), ...manualIds])
  return [...all].filter((id) => !covered.has(id))
}

describe('Akzeptanz-IDs ↔ Tests (P10.1)', () => {
  it('Quellen sind lesbar: alle fünf Dokumente liefern IDs', () => {
    const kinds = new Set(
      [...ids.keys()].map((id) => id.replace(/-\d+$/, '').replace(/-[A-Z]+$/, '')),
    )
    expect(ids.size).toBeGreaterThan(200)
    for (const id of [
      'AK-3-01',
      'EK-03',
      'DM-PROD-01',
      'AK-A-3-01',
      'T-01',
      'T-22',
      'AK-DS-01',
      'AK-SEED-01',
    ])
      expect(ids.has(id), id).toBe(true)
    expect(kinds.size).toBeGreaterThan(4)
  })

  it('jede Akzeptanz-ID hat einen Testtitel mit dieser ID oder einen Eintrag in tests/manual-checks.json', () => {
    expect(
      untraced(
        ids.keys(),
        titles,
        manual.map((m) => m.id),
      ),
    ).toEqual([])
  })

  it('Gegenprobe: eine ID aus den Testtiteln entfernen → rot; Titelformen mit Kurzschreibweise zählen', () => {
    const manualIds = manual.map((m) => m.id)
    const without = titles.map((t) => t.replace(/\bAK-SEED-01\b/g, 'AK-SEED-xx'))
    expect(untraced(ids.keys(), without, manualIds)).toEqual(['AK-SEED-01'])
    expect(untraced(['EK-10'], titles, [])).toEqual(['EK-10'])
    expect(idsInTitle('AK-4-07/-08 Reservierung')).toEqual(['AK-4-07', 'AK-4-08'])
    expect(idsInTitle('DM-PROD-01/02 Pflichtangaben')).toEqual(['DM-PROD-01', 'DM-PROD-02'])
    expect(idsInTitle('R-001 ohne Akzeptanz-ID')).toEqual([])
  })

  it('manual-checks.json: bekannte IDs, Begründung, Phase P1–P11, keine Duplikate', () => {
    expect(manual.length).toBeGreaterThan(0)
    expect(new Set(manual.map((m) => m.id)).size).toBe(manual.length)
    for (const m of manual) {
      expect(ids.has(m.id), `${m.id} kommt in keinem Dokument vor`).toBe(true)
      expect(m.phase, m.id).toMatch(/^P(?:[1-9]|1[01])$/)
      expect(m.reason.trim().length, m.id).toBeGreaterThan(20)
    }
  })

  it('manual-checks.json: Einträge, die ein Testtitel schon abdeckt, sind nur Teil-Belege (Begründung nennt den Teil)', () => {
    const covered = new Set(titles.flatMap(idsInTitle))
    for (const m of manual.filter((x) => covered.has(x.id))) {
      expect(m.reason, m.id).toMatch(/Teil|automatisch/)
    }
  })
})

describe('Testdisziplin (ARCHITEKTUR §7.2, P10.1)', () => {
  const files = listTestFiles('tests').filter((f) => !f.startsWith('tests/unit/meta/'))
  const source = (f: string) => readFileSync(path.join(ROOT, f), 'utf8')
  const open = readFileSync(path.join(ROOT, 'docs/OFFENE-PUNKTE.md'), 'utf8')

  it('kein test.only / it.only / describe.only', () => {
    const found = files.filter((f) => /\b(?:test|it|describe)\.only\b/.test(source(f)))
    expect(found).toEqual([])
  })

  it('test.fixme nur mit OFFENE-PUNKTE-Eintrag und nie bei Kasse, Reservierung oder Recht', () => {
    const fixme = files.filter((f) => /\b(?:test|it|describe)\.fixme\b/.test(source(f)))
    for (const f of fixme) {
      expect(f, 'fixme bei Kasse/Reservierung/Recht verboten').not.toMatch(
        /checkout|reserv|legal|commerce|payments|kasse|withdraw/i,
      )
      expect(open, `${f} braucht einen Eintrag in docs/OFFENE-PUNKTE.md`).toContain(
        path.basename(f),
      )
    }
  })

  it('Gegenprobe: Erkennung von only/fixme und Titeln', () => {
    expect(/\b(?:test|it|describe)\.only\b/.test("test.only('x', () => {})")).toBe(true)
    expect(/\b(?:test|it|describe)\.fixme\b/.test("test.describe.fixme('x', () => {})")).toBe(true)
    expect(extractTestTitles("it('AK-3-01 a', () => {})")).toEqual(['AK-3-01 a'])
    expect(existsSync(path.join(ROOT, 'tests/manual-checks.json'))).toBe(true)
  })
})
