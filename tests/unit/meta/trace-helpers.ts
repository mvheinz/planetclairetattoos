import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

// Hilfen der Nachverfolgungs-Tests (P10.1): Akzeptanz-IDs aus den Fachdokumenten, Testtitel aus `tests/**`.

export const ROOT = path.resolve(__dirname, '../../..')

export type IdKind = 'AK' | 'EK' | 'DM' | 'AK-A' | 'T' | 'AK-DS' | 'AK-SEED'

export interface IdSource {
  file: string
  kind: IdKind
  /** Muster mit genau einer Fanggruppe für die ID; wird zeilenweise angewendet. */
  patterns: RegExp[]
}

/**
 * Wo eine Akzeptanz-ID **definiert** wird (nicht nur erwähnt):
 * KONZEPT `- **AK-n-nn**` und Tabellenzeile `| EK-nn |`; DATENMODELL `- DM-XXX-nn:` bzw. `**Akzeptanz:** DM-XXX-nn:`;
 * ARCHITEKTUR `**AK-A-n-nn**` und `| T-nn |`; DESIGN `**AK-DS-nn**`; SEED-SPEC `| AK-SEED-nn |`.
 */
export const ID_SOURCES: IdSource[] = [
  {
    file: 'docs/KONZEPT.md',
    kind: 'AK',
    patterns: [/^\s*-?\s*\*\*(AK-\d+-\d+)\*\*/],
  },
  { file: 'docs/KONZEPT.md', kind: 'EK', patterns: [/^\|\s*(EK-\d+)\s*\|/] },
  {
    file: 'docs/DATENMODELL.md',
    kind: 'DM',
    patterns: [/^\s*-\s*(DM-[A-Z0-9]+-\d+)\b/, /\*\*Akzeptanz:\*\*\s*(DM-[A-Z0-9]+-\d+)\b/],
  },
  { file: 'docs/ARCHITEKTUR.md', kind: 'AK-A', patterns: [/^\*\*(AK-A-\d+-\d+)\*\*/] },
  { file: 'docs/ARCHITEKTUR.md', kind: 'T', patterns: [/^\|\s*(T-\d+)\s*\|/] },
  { file: 'docs/design/DESIGN.md', kind: 'AK-DS', patterns: [/^\*\*(AK-DS-\d+)\*\*/] },
  { file: 'content/seed/SEED-SPEC.md', kind: 'AK-SEED', patterns: [/^\|\s*(AK-SEED-\d+)\s*\|/] },
]

/** Alle in den Dokumenten definierten Akzeptanz-IDs, je ID die Quelldatei. */
export function collectIds(read: (rel: string) => string): Map<string, string> {
  const out = new Map<string, string>()
  for (const src of ID_SOURCES) {
    for (const line of read(src.file).split('\n')) {
      for (const re of src.patterns) {
        const m = re.exec(line)
        if (m) out.set(m[1]!, src.file)
      }
    }
  }
  return out
}

const TITLE_RE = /\b(?:test|it|describe)(?:\.\w+)*\(\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g

/** Titel aller `test(`/`it(`/`describe(`-Aufrufe einer Quelldatei. */
export function extractTestTitles(source: string): string[] {
  return [...source.matchAll(TITLE_RE)].map((m) => m[2]!)
}

/** In Titeln genannte IDs; Kurzformen `AK-4-07/-08` und `DM-PROD-01/02/03` werden aufgelöst. */
export function idsInTitle(title: string): string[] {
  const out: string[] = []
  for (const m of title.matchAll(
    /\b((?:AK-A-\d+|AK-DS|AK-SEED|AK-\d+|DM-[A-Z0-9]+|EK|T)-)(\d+)((?:\s*[/,–-]\s*-?\d+)*)/g,
  )) {
    const prefix = m[1]!
    const width = m[2]!.length
    out.push(`${prefix}${m[2]}`)
    for (const n of (m[3] ?? '').matchAll(/\d+/g)) out.push(`${prefix}${n[0].padStart(width, '0')}`)
  }
  return out
}

export function listTestFiles(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`
    if (statSync(path.join(ROOT, rel)).isDirectory()) return listTestFiles(rel)
    return /\.tsx?$/.test(name) ? [rel] : []
  })
}

export const readRel = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8')

export function allTestTitles(): string[] {
  return listTestFiles('tests').flatMap((f) => extractTestTitles(readRel(f)))
}
