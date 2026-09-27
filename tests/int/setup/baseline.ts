// Gleicher Ausgangszustand für jede Int-Testdatei (ARCHITEKTUR §7.2): Nach `db:reset --test` (Migrationen + Grund-
// Seed) sichert das globale Setup alle Daten des Schemas `public` in das Schema `pc_test_baseline`; vor jeder Datei
// werden sie wiederhergestellt. So hängt kein Test davon ab, welche Datei vorher lief (CI hat keinen Vitest-Cache und
// damit eine andere Reihenfolge als lokal). Nur für die Test-DB (Name endet auf _test, siehe setup/env.ts).
import pg from 'pg'

const SNAPSHOT = 'pc_test_baseline'
const SEQUENCES = '__sequences'
const SCRIPT = '__restore_script'
const EXCLUDED = new Set(['payload_migrations'])

const ident = (name: string) => `"${name.replaceAll('"', '""')}"`

function assertTestDatabase(url: string): void {
  if (!new URL(url).pathname.endsWith('_test')) {
    throw new Error('Baseline nur für die Test-Datenbank (Name endet auf _test).')
  }
}

async function withClient<T>(url: string, fn: (c: pg.Client) => Promise<T>): Promise<T> {
  assertTestDatabase(url)
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

async function publicTables(c: pg.Client): Promise<string[]> {
  const res = await c.query<{ name: string }>(
    `SELECT table_name AS name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`,
  )
  return res.rows.map((r) => r.name).filter((t) => !EXCLUDED.has(t))
}

async function publicSequences(c: pg.Client): Promise<string[]> {
  const res = await c.query<{ name: string }>(
    `SELECT sequence_name AS name FROM information_schema.sequences
      WHERE sequence_schema = 'public' ORDER BY sequence_name`,
  )
  return res.rows.map((r) => r.name)
}

/** SQL, das den Ausgangszustand zurückspielt (ohne Transaktionsrahmen). */
async function restoreScript(c: pg.Client): Promise<string> {
  const tables = await publicTables(c)
  const cols = await c.query<{ table: string; name: string }>(
    `SELECT table_name AS table, column_name AS name FROM information_schema.columns
      WHERE table_schema = 'public' AND is_generated = 'NEVER' ORDER BY table_name, ordinal_position`,
  )
  const byTable = new Map<string, string[]>()
  for (const r of cols.rows) byTable.set(r.table, [...(byTable.get(r.table) ?? []), ident(r.name)])
  const parts: string[] = []
  // DELETE statt TRUNCATE: bei den kleinen Testbeständen deutlich schneller (TRUNCATE legt je Tabelle neue Dateien an).
  for (const t of tables) parts.push(`DELETE FROM public.${ident(t)};`)
  for (const t of tables) {
    const list = (byTable.get(t) ?? []).join(', ')
    if (!list) continue
    const rows = await c.query<{ n: string }>(`SELECT count(*) AS n FROM ${SNAPSHOT}.${ident(t)}`)
    if (Number(rows.rows[0]!.n) === 0) continue
    parts.push(
      `INSERT INTO public.${ident(t)} (${list}) OVERRIDING SYSTEM VALUE SELECT ${list} FROM ${SNAPSHOT}.${ident(t)};`,
    )
  }
  parts.push(
    `SELECT setval(format('public.%I', name), last_value, is_called) FROM ${SNAPSHOT}.${SEQUENCES};`,
  )
  return parts.join('\n')
}

/** Sichert den aktuellen Datenbestand (nach `db:reset --test`) als Ausgangszustand. */
export async function captureBaseline(url: string): Promise<void> {
  await withClient(url, async (c) => {
    await c.query('BEGIN')
    try {
      await c.query(`DROP SCHEMA IF EXISTS ${SNAPSHOT} CASCADE`)
      await c.query(`CREATE SCHEMA ${SNAPSHOT}`)
      for (const t of await publicTables(c)) {
        await c.query(`CREATE TABLE ${SNAPSHOT}.${ident(t)} AS TABLE public.${ident(t)}`)
      }
      await c.query(
        `CREATE TABLE ${SNAPSHOT}.${SEQUENCES} (name text PRIMARY KEY, last_value bigint NOT NULL, is_called boolean NOT NULL)`,
      )
      for (const s of await publicSequences(c)) {
        await c.query(
          `INSERT INTO ${SNAPSHOT}.${SEQUENCES} SELECT $1, last_value, is_called FROM public.${ident(s)}`,
          [s],
        )
      }
      await c.query(`CREATE TABLE ${SNAPSHOT}.${SCRIPT} (body text NOT NULL)`)
      await c.query(`INSERT INTO ${SNAPSHOT}.${SCRIPT} (body) VALUES ($1)`, [
        await restoreScript(c),
      ])
      await c.query('COMMIT')
    } catch (e) {
      await c.query('ROLLBACK')
      throw e
    }
  })
}

/**
 * Stellt den gesicherten Ausgangszustand her: alle Tabellen leeren, Daten und Sequenzstände zurückspielen. Trigger
 * (GoBD-Sperre der Belege, Fremdschlüssel) sind dafür nur in dieser Transaktion aus (`session_replication_role`).
 * Das SQL dafür erzeugt `captureBaseline` einmal (schnell: eine Anfrage je Testdatei).
 */
export async function restoreBaseline(url: string): Promise<void> {
  await withClient(url, async (c) => {
    const exists = await c.query(`SELECT to_regclass('${SNAPSHOT}.${SCRIPT}') AS t`)
    if (!exists.rows[0]?.t) {
      throw new Error(
        `Ausgangszustand fehlt (${SNAPSHOT}) – Int-Tests über vitest/pnpm test:int starten.`,
      )
    }
    const script = (await c.query<{ body: string }>(`SELECT body FROM ${SNAPSHOT}.${SCRIPT}`))
      .rows[0]!.body
    try {
      await c.query(
        `BEGIN; SET LOCAL lock_timeout = '60s'; SET LOCAL session_replication_role = replica; ${script} COMMIT;`,
      )
    } catch (e) {
      await c.query('ROLLBACK')
      throw e
    }
  })
}
