// Mehrere Int-Worker (ARCHITEKTUR §7.2): Jeder Vitest-Worker bekommt eine eigene Test-Datenbank und einen eigenen
// Speicherordner samt Mail-Ausgang, damit Testdateien parallel laufen können (`PC_INT_WORKERS`, Standard 1 = nacheinander
// gegen `DATABASE_URL_TEST`). Worker 1 nutzt die Datenbank aus `DATABASE_URL_TEST`, Worker n ≥ 2 eine Kopie davon
// (`CREATE DATABASE … TEMPLATE`, enthält Migrationen, Grund-Seed und Ausgangszustand) mit Namen `<name ohne _test>_w<n>_test`.
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'

import pg from 'pg'

/** Anzahl paralleler Worker aus `PC_INT_WORKERS` (1–8, Standard 1). */
export function intWorkerCount(env: Record<string, string | undefined> = process.env): number {
  const n = Number.parseInt(env.PC_INT_WORKERS ?? '1', 10)
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 8) : 1
}

function withDatabase(url: string, database: string): string {
  const u = new URL(url)
  u.pathname = `/${database}`
  return u.toString()
}

/** Datenbank-URL für Worker `id` (1-basiert, wie `VITEST_POOL_ID`). */
export function workerDatabaseUrl(baseUrl: string, id: number): string {
  if (id <= 1) return baseUrl
  const name = decodeURIComponent(new URL(baseUrl).pathname.slice(1))
  if (!name.endsWith('_test')) throw new Error('Test-Datenbank muss auf _test enden.')
  return withDatabase(baseUrl, `${name.slice(0, -'_test'.length)}_w${id}_test`)
}

/** Legt die Kopien für Worker 2..n an (nach Migration, Seed und Baseline der Hauptdatenbank). */
export async function createWorkerDatabases(baseUrl: string, count: number): Promise<void> {
  if (count <= 1) return
  const baseName = decodeURIComponent(new URL(baseUrl).pathname.slice(1))
  const admin = new pg.Client({ connectionString: withDatabase(baseUrl, 'postgres') })
  await admin.connect()
  try {
    for (let id = 2; id <= count; id++) {
      const name = decodeURIComponent(new URL(workerDatabaseUrl(baseUrl, id)).pathname.slice(1))
      if (!/^[a-z0-9_]+$/.test(name) || !/^[a-z0-9_]+$/.test(baseName))
        throw new Error(`Ungültiger Datenbankname: ${name}`)
      await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
      await admin.query(`CREATE DATABASE "${name}" TEMPLATE "${baseName}"`)
    }
  } finally {
    await admin.end()
  }
}

/** Speicherordner (`STORAGE_LOCAL_DIR`) des Basis-Laufs; Standard `.data`. */
export function baseStorageDir(env: Record<string, string | undefined> = process.env): string {
  return path.resolve(process.cwd(), env.STORAGE_LOCAL_DIR || '.data')
}

/** Speicherordner für Worker `id`: Worker 1 den Basisordner, Worker n ≥ 2 `<Basisordner>-w<n>`. */
export function workerStorageDir(base: string, id: number): string {
  return id <= 1 ? base : `${base}-w${id}`
}

/** Kopiert die vom Grund-Seed angelegten Dateien (z. B. Rechtstext-PDFs) in die Speicherordner der Worker 2..n. */
export function createWorkerStorage(count: number): void {
  const base = baseStorageDir()
  for (let id = 2; id <= count; id++) {
    const target = workerStorageDir(base, id)
    rmSync(target, { recursive: true, force: true })
    mkdirSync(path.dirname(target), { recursive: true })
    try {
      cpSync(base, target, {
        recursive: true,
        // Nur Dateien des Grund-Seeds: weder Mail-Ausgang noch Vorschau-Export noch Reste früherer Läufe.
        filter: (src) => !['mail-outbox', 'preview-export'].includes(path.basename(src)),
      })
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
      mkdirSync(target, { recursive: true }) // Basisordner noch nicht angelegt
    }
  }
}
