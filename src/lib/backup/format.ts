import 'server-only'

import { createHash } from 'node:crypto'

// „pcdump v1“ (ARCHITEKTUR §10.3): Textformat im COPY-Stil, mit `psql` lesbar. Reine Hilfen ohne Datenbankzugriff:
// Kopf, Abschluss-Kommentar, COPY-Anweisungen (streng geprüft, weil die Wiederherstellung sie ausführt), Prüfsummen.

export const DUMP_MAGIC = '-- pcdump 1'
export const DUMP_END_PREFIX = '-- pcdump-end '
export const DUMP_SCHEMA = 'public'
/** Tabellen, die nie gesichert werden (R-134: Zähler leben ≤ 24 h). */
export const EXCLUDED_TABLES: readonly string[] = ['rate_limit_hits']

export interface DumpHeader {
  createdAt: string
  appVersion: string
  lastMigration: string | null
  pgVersion: string
}

export interface TableSummary {
  name: string
  columns: string[]
  rows: number
  md5: string
}

export interface DumpFooter {
  tables: TableSummary[]
}

export const quoteIdent = (name: string): string => `"${name.replace(/"/g, '""')}"`
export const qualified = (table: string): string => `${DUMP_SCHEMA}.${quoteIdent(table)}`

export const headerLines = (h: DumpHeader): string => `${DUMP_MAGIC}\n-- ${JSON.stringify(h)}\n`

export const copyStatement = (table: string, columns: readonly string[]): string =>
  `COPY ${qualified(table)} (${columns.map(quoteIdent).join(', ')}) FROM stdin;\n`

export const setvalStatement = (sequence: string, value: string, isCalled: boolean): string =>
  `SELECT pg_catalog.setval('${DUMP_SCHEMA}.${quoteIdent(sequence)}', ${value}, ${isCalled});\n`

export const footerLine = (f: DumpFooter): string => `${DUMP_END_PREFIX}${JSON.stringify(f)}\n`

const IDENT = '"(?:[^"]|"")+"'
const COPY_RE = new RegExp(
  `^COPY ${DUMP_SCHEMA}\\.(${IDENT}) \\((${IDENT}(?:, ${IDENT})*)\\) FROM stdin;$`,
)
const SETVAL_RE = new RegExp(
  `^SELECT pg_catalog\\.setval\\('${DUMP_SCHEMA}\\.${IDENT}', \\d+, (?:true|false)\\);$`,
)

const unquote = (q: string): string => q.slice(1, -1).replace(/""/g, '"')

/** Zerlegt eine `COPY`-Zeile; `null`, wenn sie nicht genau dem Format entspricht. */
export function parseCopyLine(line: string): { table: string; columns: string[] } | null {
  const m = COPY_RE.exec(line)
  if (!m) return null
  const columns = m[2]!.match(new RegExp(IDENT, 'g'))!.map(unquote)
  return { table: unquote(m[1]!), columns }
}

export const isSetvalLine = (line: string): boolean => SETVAL_RE.test(line)

/** Liest den Abschluss-Kommentar; `null`, wenn die Zeile keiner ist oder das JSON nicht passt. */
export function parseFooterLine(line: string): DumpFooter | null {
  if (!line.startsWith(DUMP_END_PREFIX)) return null
  try {
    const f = JSON.parse(line.slice(DUMP_END_PREFIX.length)) as DumpFooter
    if (!Array.isArray(f.tables)) return null
    return f
  } catch {
    return null
  }
}

export function parseHeaderLine(line: string): DumpHeader | null {
  if (!line.startsWith('-- {')) return null
  try {
    return JSON.parse(line.slice(3)) as DumpHeader
  } catch {
    return null
  }
}

/** Zählt Zeilen (rohe `\n` – in COPY-Text sind Zeilenumbrüche in Daten maskiert) und bildet den MD5 über alle Bytes. */
export class TableHasher {
  private readonly hash = createHash('md5')
  rows = 0
  update(chunk: Uint8Array): void {
    this.hash.update(chunk)
    for (let i = 0; i < chunk.length; i++) if (chunk[i] === 0x0a) this.rows++
  }
  digest(): string {
    return this.hash.digest('hex')
  }
}

/** Schlüssel eines Backups: `db/daily/<YYYY>/<MM>/pc-db-<YYYYMMDD>T<HHMM>Z.pcdump.gz.age` (UTC, §10.2). */
export function dailyKey(now: Date): string {
  const iso = now.toISOString() // 2026-10-05T01:30:00.000Z
  const [y, mo, d] = [iso.slice(0, 4), iso.slice(5, 7), iso.slice(8, 10)]
  const hm = iso.slice(11, 13) + iso.slice(14, 16)
  return `db/daily/${y}/${mo}/pc-db-${y}${mo}${d}T${hm}Z.pcdump.gz.age`
}

/** Monatsstand: `db/monthly/pc-db-<YYYY-MM>.pcdump.gz.age` für den Berliner Kalendermonat `monthKey`. */
export const monthlyKey = (monthKey: string): string => `db/monthly/pc-db-${monthKey}.pcdump.gz.age`
