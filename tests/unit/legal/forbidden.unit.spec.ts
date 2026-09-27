import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { V16_THIRD_PARTY_MARKS } from '@/lib/legal/forbidden'

import {
  FORBIDDEN_CONTENT_PATTERNS,
  FORBIDDEN_SOURCE_PATTERNS,
  type ForbiddenPattern,
} from '../../helpers/forbiddenPatterns'

import { FORBIDDEN_ALLOWLIST, type AllowlistEntry } from './forbidden.allowlist'

// RECHT §5 (V-01–V-31): Scan über `src/**` und `content/**` (Groß-/Kleinschreibung egal). Geprüft wird, was sich im
// Quelltext per Textsuche prüfen lässt; gerenderte Seiten und Mails prüft ab P2 `tests/e2e/legal/forbidden.e2e.spec.ts`.
// V-13 (unbelegte Produktaussagen) setzt die Veröffentlichungsprüfung durch (R-044, R-045); V-18, V-28, V-29 sind
// manuelle Sichtung; V-09, V-20, V-30, V-31 betreffen gerenderten Text (e2e). Ausnahmen: `forbidden.allowlist.ts`.

const ROOT = path.resolve(__dirname, '../../..')
const TEXT_EXT = /\.(ts|tsx|js|mjs|cjs|json|css|scss|md|mdx|txt|html|svg|yml|yaml)$/i
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', '.data'])

export interface Finding {
  file: string
  line: number
  id: string
  text: string
}

function listFiles(dir: string): string[] {
  let entries: string[]
  try {
    entries = readdirSync(path.join(ROOT, dir))
  } catch {
    return []
  }
  return entries.flatMap((name) => {
    if (SKIP_DIRS.has(name)) return []
    const rel = `${dir}/${name}`
    if (statSync(path.join(ROOT, rel)).isDirectory()) return listFiles(rel)
    return TEXT_EXT.test(name) ? [rel] : []
  })
}

const v16 = V16_THIRD_PARTY_MARKS.map((r): ForbiddenPattern => ({
  id: 'V-16',
  re: new RegExp(r.pattern.source, 'iu'),
}))

/** Muster je Datei: Inhalte zusätzlich mit der Marken-/Figurenliste V-16 (Seed-Texte zu Verkaufsware). */
export function patternsFor(file: string): readonly ForbiddenPattern[] {
  const base = [...FORBIDDEN_CONTENT_PATTERNS, ...FORBIDDEN_SOURCE_PATTERNS]
  return file.startsWith('content/') ? [...base, ...v16] : base
}

/** Alle Treffer einer Datei (eine Zeile kann mehrere IDs treffen). */
export function scanText(
  file: string,
  text: string,
  patterns: readonly ForbiddenPattern[],
): Finding[] {
  const out: Finding[] = []
  text.split('\n').forEach((line, i) => {
    for (const { id, re } of patterns) {
      const m = re.exec(line)
      if (m) out.push({ file, line: i + 1, id, text: m[0] })
    }
  })
  return out
}

const matches = (entry: AllowlistEntry, f: Finding) =>
  entry.file === f.file && entry.id === f.id && (!entry.match || f.text.includes(entry.match))

/** Treffer ohne Allowlist-Eintrag und Allowlist-Einträge ohne Treffer (veraltet). */
export function applyAllowlist(
  findings: Finding[],
  allowlist: readonly AllowlistEntry[],
): { violations: Finding[]; unused: AllowlistEntry[] } {
  return {
    violations: findings.filter((f) => !allowlist.some((e) => matches(e, f))),
    unused: allowlist.filter((e) => !findings.some((f) => matches(e, f))),
  }
}

const files = [...listFiles('src'), ...listFiles('content')]
const findings = files.flatMap((f) =>
  scanText(f, readFileSync(path.join(ROOT, f), 'utf8'), patternsFor(f)),
)

describe('RECHT §5 Verbotsmuster in src/** und content/**', () => {
  it('V-01–V-31 kein Treffer außerhalb der begründeten Allowlist', () => {
    expect(files.length).toBeGreaterThan(100)
    const { violations } = applyAllowlist(findings, FORBIDDEN_ALLOWLIST)
    expect(violations.map((v) => `${v.file}:${v.line} ${v.id} „${v.text}“`)).toEqual([])
  })

  it('Allowlist: jeder Eintrag hat eine Begründung und wird noch gebraucht', () => {
    for (const e of FORBIDDEN_ALLOWLIST) expect(e.reason.length, e.file).toBeGreaterThan(15)
    const { unused } = applyAllowlist(findings, FORBIDDEN_ALLOWLIST)
    expect(unused).toEqual([])
  })

  it('V-01, V-02, V-03 Gegenprobe: OS-Link, „inkl. MwSt.“ und vorbelegtes Häkchen werden erkannt', () => {
    const sample = [
      '<a href="https://ec.europa.eu/consumers/odr">OS</a>',
      'Preis 20 € inkl. MwSt.',
      '<input type="checkbox" defaultChecked />',
      '<input type="checkbox" checked={true} />',
      '<input type="checkbox" defaultChecked={false} />',
    ].join('\n')
    const ids = scanText('src/x.tsx', sample, patternsFor('src/x.tsx')).map(
      (f) => `${f.line}:${f.id}`,
    )
    expect(ids).toEqual(['1:V-01', '2:V-02', '3:V-03', '4:V-03'])
    const godzilla = scanText(
      'content/seed/data/products.json',
      '"title": "Godzilla-Tasse"',
      patternsFor('content/seed/data/products.json'),
    )
    expect(godzilla.map((f) => f.id)).toEqual(['V-16'])
    const { violations } = applyAllowlist(
      [{ file: 'src/a.ts', line: 1, id: 'V-01', text: 'ODR' }],
      [{ file: 'src/a.ts', id: 'V-02', reason: 'andere ID – deckt den Treffer nicht ab' }],
    )
    expect(violations).toHaveLength(1)
  })
})
