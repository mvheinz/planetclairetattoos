import 'server-only'

import { Readable } from 'node:stream'

import pg from 'pg'
import { to as copyTo } from 'pg-copy-streams'

import {
  copyStatement,
  DUMP_SCHEMA,
  EXCLUDED_TABLES,
  footerLine,
  headerLines,
  qualified,
  quoteIdent,
  setvalStatement,
  TableHasher,
  type DumpHeader,
  type TableSummary,
} from './format'

// Datenbank-Dump „pcdump v1“ (ARCHITEKTUR §10.3, Spike B-06): ein Schnappschuss (`REPEATABLE READ, READ ONLY`), alle
// Tabellen des Schemas `public` außer `rate_limit_hits`, Zeilen sortiert nach Primärschlüssel (deterministisch), je
// Tabelle Zeilenzahl und MD5 im Abschluss-Kommentar. Läuft ohne `pg_dump` (auf Vercel gibt es keins).

export interface DumpOptions {
  connectionString: string
  appVersion: string
  now: Date
  /** Zusätzlich auszuschließende Tabellen (Tests). */
  excludeTables?: readonly string[]
}

export interface DumpResult {
  header: DumpHeader
  tables: TableSummary[]
  rows: number
}

interface TableInfo {
  name: string
  columns: string[]
  orderBy: string
}

async function listTables(client: pg.Client, excluded: ReadonlySet<string>): Promise<TableInfo[]> {
  const tables = await client.query<{ oid: number; relname: string }>(
    `SELECT c.oid, c.relname FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND c.relkind = 'r' AND NOT c.relispartition
      ORDER BY c.relname COLLATE "C"`,
    [DUMP_SCHEMA],
  )
  const out: TableInfo[] = []
  for (const t of tables.rows) {
    if (excluded.has(t.relname)) continue
    const cols = await client.query<{ attname: string }>(
      `SELECT attname FROM pg_catalog.pg_attribute
        WHERE attrelid = $1 AND attnum > 0 AND NOT attisdropped AND attgenerated = ''
        ORDER BY attnum`,
      [t.oid],
    )
    const columns = cols.rows.map((c) => c.attname)
    const pk = await client.query<{ attname: string }>(
      `SELECT a.attname FROM pg_catalog.pg_index i
         JOIN pg_catalog.pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
        WHERE i.indrelid = $1 AND i.indisprimary
        ORDER BY array_position(i.indkey::int2[], a.attnum)`,
      [t.oid],
    )
    // Ohne Primärschlüssel: nach allen Spalten (als Text) sortieren – ebenfalls deterministisch.
    const orderCols =
      pk.rows.length > 0
        ? pk.rows.map((r) => quoteIdent(r.attname))
        : columns.map((c) => `${quoteIdent(c)}::text`)
    out.push({ name: t.relname, columns, orderBy: orderCols.join(', ') })
  }
  return out
}

/**
 * Erzeugt den Klartext-Dump als Strom. `summary` löst nach dem letzten Byte auf (Zeilenzahlen, MD5); bei einem Fehler
 * wird der Strom mit dem Fehler beendet und `summary` abgelehnt.
 */
export function createDumpStream(opts: DumpOptions): {
  stream: Readable
  summary: Promise<DumpResult>
} {
  let resolveSummary!: (r: DumpResult) => void
  let rejectSummary!: (e: unknown) => void
  const summary = new Promise<DumpResult>((res, rej) => {
    resolveSummary = res
    rejectSummary = rej
  })
  // Niemand muss `summary` abwarten, wenn der Strom schon fehlschlägt – keine „unhandled rejection“.
  summary.catch(() => undefined)
  const excluded = new Set([...EXCLUDED_TABLES, ...(opts.excludeTables ?? [])])

  async function* generate(): AsyncGenerator<Buffer | string> {
    const client = new pg.Client({ connectionString: opts.connectionString })
    await client.connect()
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ, READ ONLY')
      const version = await client.query<{ v: string }>('SHOW server_version')
      const migration = await client
        .query<{ name: string }>(
          'SELECT name FROM public.payload_migrations ORDER BY created_at DESC, id DESC LIMIT 1',
        )
        .catch(async () => {
          // Tabelle fehlt (leere DB): die Transaktion ist abgebrochen – neu beginnen.
          await client.query('ROLLBACK')
          await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ, READ ONLY')
          return { rows: [] as { name: string }[] }
        })
      const header: DumpHeader = {
        createdAt: opts.now.toISOString(),
        appVersion: opts.appVersion,
        lastMigration: migration.rows[0]?.name ?? null,
        pgVersion: version.rows[0]!.v,
      }
      yield headerLines(header)

      const tables = await listTables(client, excluded)
      const summaries: TableSummary[] = []
      for (const t of tables) {
        yield copyStatement(t.name, t.columns)
        const hasher = new TableHasher()
        const sql = `COPY (SELECT ${t.columns.map(quoteIdent).join(', ')} FROM ${qualified(t.name)} ORDER BY ${t.orderBy}) TO STDOUT`
        for await (const chunk of client.query(copyTo(sql)) as AsyncIterable<Buffer>) {
          hasher.update(chunk)
          yield chunk
        }
        yield '\\.\n'
        summaries.push({
          name: t.name,
          columns: t.columns,
          rows: hasher.rows,
          md5: hasher.digest(),
        })
      }

      const seqs = await client.query<{ sequencename: string; last_value: string | null }>(
        `SELECT sequencename, last_value::text FROM pg_catalog.pg_sequences
          WHERE schemaname = $1 ORDER BY sequencename COLLATE "C"`,
        [DUMP_SCHEMA],
      )
      for (const s of seqs.rows) {
        yield s.last_value === null
          ? setvalStatement(s.sequencename, '1', false)
          : setvalStatement(s.sequencename, s.last_value, true)
      }
      yield footerLine({ tables: summaries })
      resolveSummary({ header, tables: summaries, rows: summaries.reduce((n, t) => n + t.rows, 0) })
    } catch (e) {
      rejectSummary(e)
      throw e
    } finally {
      await client.query('ROLLBACK').catch(() => undefined)
      await client.end().catch(() => undefined)
    }
  }

  return { stream: Readable.from(generate(), { objectMode: false }), summary }
}
