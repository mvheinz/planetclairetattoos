// Kriterien-Katalog der Kunst-Abnahme aus `docs/design/KUNST-QA.md` §5 (PLAN P9.5/P9.6): Die Tabellen §5.1–§5.10 sind
// die einzige Quelle für ID, Kriterium, Schwelle, Methode und Schwere. `pnpm art:check` liest sie zur Laufzeit; der
// Parser-Test gleicht die Liste der automatischen Prüfungen gegen die Tabellen ab. Rein.

export type Lens = 'R1' | 'R2' | 'R3'
export type Severity = 'B' | 'M' | 'm'

export interface Criterion {
  id: string
  /** Abschnitt, z. B. `5.1`. */
  section: string
  /** Bereich laut Überschrift, z. B. `Linie (LQ)`. */
  area: string
  lens: Lens
  title: string
  threshold: string
  method: string
  /** `auto` steht in der Methode → `pnpm art:check` entscheidet (ggf. zusätzlich Urteil der Linse). */
  auto: boolean
  /** Urteilsanteil der Linse (`R1`/`R2`/`R3` in der Methode). */
  judgement: Lens | null
  severity: string
}

export const KUNST_QA_FILE = 'docs/design/KUNST-QA.md'

/** Tabellenzeile in Zellen (ohne Rand), `\|` in Zellen bleibt erhalten. */
function cells(line: string): string[] {
  const inner = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return inner.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'))
}

/** Alle Kriterien aus §5 (Abschnitte `### 5.n … – Linse Rk`). */
export function parseCriteria(markdown: string): Criterion[] {
  const out: Criterion[] = []
  const start = markdown.indexOf('## 5. Abnahmekriterien')
  const end = markdown.indexOf('\n## 6.', start)
  if (start < 0) throw new Error('KUNST-QA §5 nicht gefunden.')
  const body = markdown.slice(start, end < 0 ? undefined : end)
  let section = ''
  let area = ''
  let lens: Lens = 'R1'
  for (const line of body.split('\n')) {
    const h = /^### (5\.\d+) (.+?) – Linse (R[123])/.exec(line)
    if (h) {
      section = h[1]!
      area = h[2]!.replace(/\s+$/, '')
      lens = h[3] as Lens
      continue
    }
    if (!section || !/^\|\s*[A-Z0-9]+-\d{2}\s*\|/.test(line)) continue
    const [id, title, threshold, method, severity] = cells(line)
    const m = method ?? ''
    const j = /\bR([123])\b/.exec(m)
    out.push({
      id: id!,
      section,
      area,
      lens,
      title: title ?? '',
      threshold: threshold ?? '',
      method: m,
      auto: /\bauto\b/.test(m),
      judgement: j ? (`R${j[1]}` as Lens) : m.includes('auto') && /\+\s*R/.test(m) ? lens : null,
      severity: severity ?? '',
    })
  }
  return out
}

/** Schwere als einzelner Buchstabe (bei „B (Band-Bezug) / m“ die strengste). */
export function severityOf(c: Pick<Criterion, 'severity'>): Severity {
  if (/\bB\b/.test(c.severity)) return 'B'
  if (/\bM\b/.test(c.severity)) return 'M'
  return 'm'
}
