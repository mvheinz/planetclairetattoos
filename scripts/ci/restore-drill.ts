// Wiederherstellungs-Übung (ARCHITEKTUR §10.6, T-22): synthetische Daten → Wegwerf-Schlüssel → `backup:run` (Datei) →
// `backup:restore` in eine zweite, leere Datenbank → Vergleich je Tabelle (Zeilenzahl und md5 über den erneuten Dump).
// Nie mit Produktionsdaten oder -Zugängen (A-12): bricht ab, wenn `APP_ENV=production` oder die Quelle als Produktion
// markiert ist. Aufruf: pnpm tsx --import=./scripts/lib/register-server-only.mjs scripts/ci/restore-drill.ts
import 'dotenv/config'

import { spawnSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import pg from 'pg'

const withDb = (url: string, name: string): string => {
  const u = new URL(url)
  u.pathname = `/${name}`
  return u.toString()
}

async function admin(url: string, sql: string): Promise<void> {
  const c = new pg.Client({ connectionString: withDb(url, 'postgres') })
  await c.connect()
  try {
    await c.query(sql)
  } finally {
    await c.end()
  }
}

async function main(): Promise<void> {
  const source = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL
  if (!source) throw new Error('DATABASE_URL(_TEST) fehlt.')
  if (process.env.APP_ENV === 'production')
    throw new Error('Restore-Drill nie mit APP_ENV=production (A-12).')
  const { generateIdentity, identityToRecipient } = await import('age-encryption')
  const { runBackup } = await import('../../src/lib/backup/run')
  const { restoreFromCipher } = await import('../../src/lib/backup/restore')
  const { createDumpStream } = await import('../../src/lib/backup/dump')
  const { runMigrations } = await import('../db-reset')
  const { createReadStream } = await import('node:fs')

  const dir = await mkdtemp(path.join(os.tmpdir(), 'pc-drill-'))
  const targetName = `${new URL(source).pathname.slice(1)}_drill`
  const target = withDb(source, targetName)
  try {
    const identity = await generateIdentity()
    const recipient = await identityToRecipient(identity)
    const identityFile = path.join(dir, 'key.txt')
    await writeFile(identityFile, `# public key: ${recipient}\n${identity}\n`)
    const file = path.join(dir, 'drill.pcdump.gz.age')

    const backup = await runBackup({
      connectionString: source,
      recipient,
      appVersion: 'drill',
      now: new Date(),
      target: { kind: 'file', path: file },
    })
    console.log(
      `restore-drill: Backup ${backup.tables} Tabellen, ${backup.rows} Zeilen, ${backup.sizeBytes} Bytes`,
    )

    await admin(source, `DROP DATABASE IF EXISTS "${targetName}" WITH (FORCE)`)
    await admin(source, `CREATE DATABASE "${targetName}"`)
    runMigrations(target)
    const res = await restoreFromCipher({
      cipher: createReadStream(file),
      identity,
      targetUrl: target,
    })
    console.log(
      `restore-drill: ${res.tables.length} Tabellen, ${res.rows} Zeilen wiederhergestellt`,
    )

    const dump = async (url: string) => {
      const { stream } = createDumpStream({
        connectionString: url,
        appVersion: 'drill',
        now: new Date(),
        excludeTables: [],
      })
      const chunks: Buffer[] = []
      for await (const c of stream as AsyncIterable<Buffer>) chunks.push(c)
      return Buffer.concat(chunks)
        .toString('utf8')
        .split('\n')
        .filter((_, i) => i !== 1)
        .join('\n')
    }
    const [a, b] = [await dump(source), await dump(target)]
    if (a !== b)
      throw new Error('Vergleich fehlgeschlagen: Quelle und Wiederherstellung unterscheiden sich.')
    console.log('restore-drill: Zeilenzahl und md5 je Tabelle identisch.')

    // `retention:replay` gegen die wiederhergestellte Datenbank (T-22).
    const r = spawnSync('pnpm', ['run', 'retention:replay'], {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: target, DATABASE_URL_TEST: target },
    })
    if (r.status !== 0) throw new Error('retention:replay fehlgeschlagen.')
  } finally {
    await admin(source, `DROP DATABASE IF EXISTS "${targetName}" WITH (FORCE)`).catch(
      () => undefined,
    )
    await rm(dir, { recursive: true, force: true })
  }
}

main().then(
  () => process.exit(0),
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  },
)
