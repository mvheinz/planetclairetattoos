// Datenbank des Vorschau-Exports (ARCHITEKTUR §14.2 Nr. 2, KONZEPT §12.3 Nr. 2): eigene Datenbank
// `planetclaire_preview_export` auf dem Server aus DATABASE_URL anlegen (db:ensure), Schema leeren, migrieren,
// Grund-Seed und Beispielbestand. Dateiablage `.data/preview-export/` wird vorher geleert. Die Datenbank bleibt nach dem
// Lauf für die Fehlersuche bestehen. Nur Seed-Daten (DATENMODELL §13.6).
import { spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import path from 'node:path'

import pg from 'pg'

import { databaseNameFromUrl, destructiveActionBlockedReason } from '../../src/lib/db/guard'

import { EXPORT_DB_NAME, EXPORT_STORAGE_DIR, maintenanceDatabaseUrl } from './env'
import { ExportError } from './errors'

async function withClient<T>(url: string, fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5000 })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

/** Prüft, ob der Postgres-Server erreichbar ist (Voraussetzung, sonst Exit 2). */
export async function postgresReachable(sourceUrl: string): Promise<string | null> {
  try {
    await withClient(maintenanceDatabaseUrl(sourceUrl), (c) => c.query('SELECT 1'))
    return null
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}

/** `db:ensure` für die Export-Datenbank. */
export async function ensureExportDatabase(exportUrl: string): Promise<void> {
  const name = databaseNameFromUrl(exportUrl)
  if (name !== EXPORT_DB_NAME) throw new ExportError(1, `Unerwartete Export-Datenbank ${name}.`)
  await withClient(maintenanceDatabaseUrl(exportUrl), async (c) => {
    const exists = await c.query('SELECT 1 FROM pg_database WHERE datname = $1', [name])
    if (!exists.rowCount) await c.query(`CREATE DATABASE "${EXPORT_DB_NAME}"`)
  })
}

/** Schemas leeren – nur die Export-Datenbank, nie eine als Produktion markierte (ARCHITEKTUR §4.8). */
export async function clearExportDatabase(exportUrl: string): Promise<void> {
  const name = databaseNameFromUrl(exportUrl)
  await withClient(exportUrl, async (c) => {
    const marked = await c.query<{ comment: string | null }>(
      "SELECT shobj_description(oid, 'pg_database') AS comment FROM pg_database WHERE datname = current_database()",
    )
    const reason =
      name !== EXPORT_DB_NAME
        ? `Datenbank ${name} ist nicht die Export-Datenbank.`
        : destructiveActionBlockedReason({
            appEnv: 'preview',
            databaseName: name,
            isProductionMarked: marked.rows[0]?.comment === 'planetclaire:production',
          })
    if (reason) throw new ExportError(1, reason)
    await c.query('DROP SCHEMA IF EXISTS public CASCADE')
    await c.query('DROP SCHEMA IF EXISTS payload CASCADE')
    await c.query('CREATE SCHEMA public')
  })
}

function run(cmd: string, args: string[], env: Record<string, string>, what: string): void {
  const res = spawnSync(cmd, args, { stdio: 'inherit', env: env as NodeJS.ProcessEnv })
  if (res.status !== 0) throw new ExportError(1, `${what} fehlgeschlagen (Exit ${res.status}).`)
}

/** Kompletter Datenbank-Schritt: anlegen, leeren, migrieren, `seed:base`, `seed:example`. */
export async function prepareExportDatabase(
  env: Record<string, string>,
  root: string,
): Promise<void> {
  const url = env.DATABASE_URL!
  rmSync(path.join(root, EXPORT_STORAGE_DIR), { recursive: true, force: true })
  await ensureExportDatabase(url)
  await clearExportDatabase(url)
  const startedAt = new Date()
  run('pnpm', ['-s', 'payload', 'migrate'], env, 'payload migrate')
  run('pnpm', ['-s', 'seed:base'], env, 'seed:base')
  run('pnpm', ['-s', 'seed:example'], env, 'seed:example')
  await normalizeRunTimestamps(url, env.SEED_NOW!, startedAt, new Date())
}

/**
 * Zeitstempel, die Migration und Seed mit der echten Uhr schreiben (`created_at`/`updated_at` zwischen Start und Ende
 * dieses Schritts), auf
 * `SEED_NOW` setzen – nur in der Export-Datenbank. Sonst zeigen die Verwaltungs-Fotos (z. B. Spalte „Geändert“) je
 * Lauf eine andere Uhrzeit und zwei Läufe am selben Tag wären nicht byte-gleich (AK-A-14-01).
 */
export async function normalizeRunTimestamps(
  exportUrl: string,
  seedNow: string,
  from: Date,
  to: Date,
): Promise<void> {
  if (databaseNameFromUrl(exportUrl) !== EXPORT_DB_NAME) {
    throw new ExportError(1, 'Zeitstempel werden nur in der Export-Datenbank angeglichen.')
  }
  await withClient(exportUrl, async (c) => {
    const cols = await c.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND column_name IN ('created_at', 'updated_at')
         AND data_type LIKE 'timestamp%' ORDER BY table_name, column_name`,
    )
    // Nur in der Wegwerf-Datenbank des Exports: Trigger (z. B. der GoBD-Wächter der Belege, der `created_at` sperrt)
    // für diese eine Transaktion aussetzen – mit dem vollen Beispielbestand (P8) haben Beispielbelege einen
    // `created_at` aus dem Seed-Lauf (PLAN P8.21).
    await c.query('BEGIN')
    try {
      await c.query('SET LOCAL session_replication_role = replica')
      for (const { table_name: t, column_name: col } of cols.rows) {
        if (!/^[a-z0-9_]+$/.test(t) || !/^[a-z_]+$/.test(col)) continue
        await c.query(
          `UPDATE "${t}" SET "${col}" = $1::timestamptz WHERE "${col}" BETWEEN $2 AND $3`,
          [seedNow, new Date(from.getTime() - 1000), new Date(to.getTime() + 1000)],
        )
      }
      await c.query('COMMIT')
    } catch (err) {
      await c.query('ROLLBACK')
      throw err
    }
  })
}
