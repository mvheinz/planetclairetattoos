import 'server-only'

import { createHash } from 'node:crypto'
import type { Readable } from 'node:stream'

import pg from 'pg'
import { from as copyFrom } from 'pg-copy-streams'

import { isProductionDatabase } from '@/lib/db/guard'

import { decryptStream } from './crypto'
import {
  DUMP_MAGIC,
  DUMP_SCHEMA,
  EXCLUDED_TABLES,
  isSetvalLine,
  parseCopyLine,
  parseFooterLine,
  parseHeaderLine,
  qualified,
  quoteIdent,
  TableHasher,
  type DumpFooter,
  type DumpHeader,
  type TableSummary,
} from './format'

// Wiederherstellung (ARCHITEKTUR §10.5 Schritt 3 a–d) in eine leere, bereits migrierte Datenbank – alles in **einer**
// Transaktion: schlägt irgendeine Prüfung fehl (fehlender Abschluss, Zeilenzahl, MD5, kaputte Verschlüsselung), wird alles
// zurückgerollt und es bleibt eine leere Datenbank.

export class RestoreError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RestoreError'
  }
}

export interface RestoreOptions {
  /** Entschlüsselter, entpackter Dump (siehe `restoreFromCipher`). */
  plain: Readable
  targetUrl: string
}

export interface RestoreResult {
  header: DumpHeader
  tables: TableSummary[]
  rows: number
}

/** Tabellen, deren Zeilen nach `migrate` schon vorhanden sein dürfen (sie stehen ebenfalls im Dump und werden ersetzt). */
const MIGRATION_TABLES: readonly string[] = ['payload_migrations']

export async function assertTargetEmpty(client: pg.Client): Promise<void> {
  if (await isProductionDatabase(client)) {
    throw new RestoreError(
      'Das Ziel ist als Produktion markiert – Wiederherstellung verweigert (§10.5, §4.8).',
    )
  }
  const tables = await client.query<{ relname: string }>(
    `SELECT c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND c.relkind = 'r' AND NOT c.relispartition`,
    [DUMP_SCHEMA],
  )
  if (tables.rows.length === 0) {
    throw new RestoreError(
      'Das Ziel hat keine Tabellen – zuerst `payload migrate` ausführen (§10.5 Schritt 3 b).',
    )
  }
  for (const t of tables.rows) {
    if (MIGRATION_TABLES.includes(t.relname) || EXCLUDED_TABLES.includes(t.relname)) continue
    const r = await client.query(`SELECT 1 FROM ${qualified(t.relname)} LIMIT 1`)
    if (r.rowCount)
      throw new RestoreError(`Das Ziel ist nicht leer (Tabelle ${t.relname} hat Zeilen).`)
  }
}

/** Zeilenweise über Bytes (COPY-Text ist UTF-8, `\n` trennt Zeilen; Daten-`\n` sind maskiert). */
async function* lines(plain: Readable): AsyncGenerator<Buffer> {
  let rest: Buffer = Buffer.alloc(0)
  for await (const chunk of plain as AsyncIterable<Buffer>) {
    rest = rest.length ? Buffer.concat([rest, chunk]) : chunk
    let start = 0
    let idx: number
    while ((idx = rest.indexOf(0x0a, start)) !== -1) {
      yield rest.subarray(start, idx)
      start = idx + 1
    }
    rest = rest.subarray(start)
  }
  if (rest.length) yield rest
}

export async function restoreDump(opts: RestoreOptions): Promise<RestoreResult> {
  const client = new pg.Client({ connectionString: opts.targetUrl })
  await client.connect()
  try {
    await assertTargetEmpty(client)
    await client.query('BEGIN')
    try {
      const result = await load(client, opts.plain)
      await client.query('COMMIT')
      await client.query('ANALYZE')
      return result
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw e
    }
  } finally {
    await client.end().catch(() => undefined)
  }
}

async function load(client: pg.Client, plain: Readable): Promise<RestoreResult> {
  // c) Fremdschlüssel sichern und entfernen, Nutzer-Trigger deaktivieren.
  const fks = await client.query<{ tbl: string; conname: string; def: string }>(
    `SELECT conrelid::regclass::text AS tbl, conname, pg_get_constraintdef(oid) AS def
       FROM pg_catalog.pg_constraint WHERE contype = 'f' AND connamespace = $1::regnamespace ORDER BY oid`,
    [DUMP_SCHEMA],
  )
  const allTables = (
    await client.query<{ relname: string }>(
      `SELECT c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1 AND c.relkind = 'r' AND NOT c.relispartition`,
      [DUMP_SCHEMA],
    )
  ).rows.map((r) => r.relname)
  for (const fk of fks.rows) {
    await client.query(`ALTER TABLE ${fk.tbl} DROP CONSTRAINT ${quoteIdent(fk.conname)}`)
  }
  for (const t of allTables) await client.query(`ALTER TABLE ${qualified(t)} DISABLE TRIGGER USER`)

  let header: DumpHeader | null = null
  let footer: DumpFooter | null = null
  const loaded: TableSummary[] = []
  const setvals: string[] = []
  let lineNo = 0
  let inTable: {
    table: string
    columns: string[]
    hasher: TableHasher
    sink: ReturnType<typeof copyFrom> & NodeJS.WritableStream
    done: Promise<void>
  } | null = null

  for await (const raw of lines(plain)) {
    lineNo++
    if (inTable) {
      if (raw.length === 2 && raw[0] === 0x5c && raw[1] === 0x2e) {
        inTable.sink.end()
        await inTable.done
        loaded.push({
          name: inTable.table,
          columns: inTable.columns,
          rows: inTable.hasher.rows,
          md5: inTable.hasher.digest(),
        })
        inTable = null
        continue
      }
      const withNl = Buffer.concat([raw, Buffer.from('\n')])
      inTable.hasher.update(withNl)
      if (!inTable.sink.write(withNl)) {
        await new Promise<void>((res, rej) => {
          inTable!.sink.once('drain', res)
          inTable!.sink.once('error', rej)
        })
      }
      continue
    }
    const line = raw.toString('utf8')
    if (lineNo === 1) {
      if (line !== DUMP_MAGIC)
        throw new RestoreError('Kein pcdump 1 (erste Zeile fehlt oder falsch).')
      continue
    }
    if (lineNo === 2) {
      header = parseHeaderLine(line)
      if (!header) throw new RestoreError('pcdump-Kopf (Zeile 2) unlesbar.')
      continue
    }
    const copy = parseCopyLine(line)
    if (copy) {
      if (!allTables.includes(copy.table)) {
        throw new RestoreError(
          `Die Tabelle ${copy.table} aus dem Dump fehlt im Ziel (Migrationen fehlen?).`,
        )
      }
      await client.query(`TRUNCATE TABLE ${qualified(copy.table)}`)
      const sink = client.query(copyFrom(line.replace(/^COPY /, 'COPY ').trimEnd())) as ReturnType<
        typeof copyFrom
      > &
        NodeJS.WritableStream
      const done = new Promise<void>((res, rej) => {
        sink.once('finish', () => res())
        sink.once('error', rej)
      })
      done.catch(() => undefined)
      inTable = { table: copy.table, columns: copy.columns, hasher: new TableHasher(), sink, done }
      continue
    }
    if (isSetvalLine(line)) {
      setvals.push(line)
      continue
    }
    const f = parseFooterLine(line)
    if (f) {
      footer = f
      continue
    }
    if (line.trim() === '') continue
    throw new RestoreError(`Unerwartete Zeile ${lineNo} im Dump.`)
  }
  if (inTable) throw new RestoreError('Der Dump endet mitten in einer Tabelle (unvollständig).')
  if (!header) throw new RestoreError('pcdump-Kopf fehlt.')
  if (!footer)
    throw new RestoreError('Der Dump ist unvollständig: Abschluss-Kommentar `-- pcdump-end` fehlt.')

  // c) Sequenzen setzen, Trigger und Fremdschlüssel wieder herstellen (mit Validierung).
  for (const s of setvals) await client.query(s)
  for (const t of allTables) await client.query(`ALTER TABLE ${qualified(t)} ENABLE TRIGGER USER`)
  for (const fk of fks.rows) {
    await client.query(`ALTER TABLE ${fk.tbl} ADD CONSTRAINT ${quoteIdent(fk.conname)} ${fk.def}`)
  }

  // d) Vergleich je Tabelle: Abschluss-Kommentar gegen Geladenes und gegen die Datenbank.
  const expected = new Map(footer.tables.map((t) => [t.name, t]))
  const problems: string[] = []
  for (const t of loaded) {
    const e = expected.get(t.name)
    if (!e) problems.push(`${t.name}: nicht im Abschluss-Kommentar`)
    else if (e.rows !== t.rows || e.md5 !== t.md5) {
      problems.push(
        `${t.name}: Zeilen ${t.rows}/${e.rows}, md5 ${t.md5 === e.md5 ? 'gleich' : 'abweichend'}`,
      )
    }
    const count = await client.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM ${qualified(t.name)}`,
    )
    if (Number(count.rows[0]!.n) !== (e?.rows ?? -1))
      problems.push(`${t.name}: Datenbank hat ${count.rows[0]!.n} Zeilen statt ${e?.rows}`)
  }
  for (const e of footer.tables)
    if (!loaded.some((t) => t.name === e.name)) problems.push(`${e.name}: fehlt im Dump`)
  if (problems.length)
    throw new RestoreError(`Prüfung nach dem Laden fehlgeschlagen: ${problems.join('; ')}`)

  return { header, tables: loaded, rows: loaded.reduce((n, t) => n + t.rows, 0) }
}

/** Chiffrat (age, gzip) → Wiederherstellung. Der Schlüssel `identity` ist die `AGE-SECRET-KEY-1…`-Zeile. */
export async function restoreFromCipher(opts: {
  cipher: Readable
  identity: string
  targetUrl: string
}): Promise<RestoreResult> {
  const plain = await decryptStream(opts.cipher, opts.identity)
  return restoreDump({ plain, targetUrl: opts.targetUrl })
}

/** SHA-256 (hex) eines Stroms (für `backup:verify`). */
export async function sha256Of(
  stream: AsyncIterable<Buffer | Uint8Array>,
): Promise<{ sha256: string; sizeBytes: number; head: Buffer }> {
  const h = createHash('sha256')
  let size = 0
  let head: Buffer = Buffer.alloc(0)
  for await (const c of stream) {
    const b = Buffer.from(c)
    if (head.length < 64) head = Buffer.concat([head, b]).subarray(0, 64)
    h.update(b)
    size += b.length
  }
  return { sha256: h.digest('hex'), sizeBytes: size, head }
}
