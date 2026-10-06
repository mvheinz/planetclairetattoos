// Backup einspielen (ARCHITEKTUR §10.5 Schritt 3): pnpm backup:restore (--input=<datei>|--key=<db/…>) --identity=<pfad>
// --target=<URL der leeren Datenbank> [--skip-migrate]. Der private age-Schlüssel kommt nur aus einer Datei.
// Ziel muss leer und nicht als Produktion markiert sein; Zeilenzahl und MD5 je Tabelle werden geprüft (Exit 1 bei Abweichung).
import 'dotenv/config'

import { createReadStream } from 'node:fs'
import { readFile } from 'node:fs/promises'

import { runMigrations } from './db-reset'

export interface BackupRestoreArgs {
  input: string | null
  key: string | null
  identity: string
  target: string
  skipMigrate: boolean
}

export function parseBackupRestoreArgs(argv: readonly string[]): BackupRestoreArgs {
  const out: BackupRestoreArgs = {
    input: null,
    key: null,
    identity: '',
    target: '',
    skipMigrate: false,
  }
  for (const a of argv) {
    if (a.startsWith('--input=')) out.input = a.slice(8)
    else if (a.startsWith('--key=')) out.key = a.slice(6)
    else if (a.startsWith('--identity=')) out.identity = a.slice(11)
    else if (a.startsWith('--target=')) out.target = a.slice(9)
    else if (a === '--skip-migrate') out.skipMigrate = true
    else throw new Error(`Unbekannte Option: ${a}`)
  }
  if (!out.input === !out.key)
    throw new Error('Genau eine Quelle angeben: --input=<datei> oder --key=<db/…>.')
  if (!out.identity)
    throw new Error('--identity=<pfad zur Schlüsseldatei> fehlt (nie als Umgebungsvariable).')
  if (!out.target) throw new Error('--target=<URL der leeren Datenbank> fehlt.')
  return out
}

async function main(): Promise<void> {
  const args = parseBackupRestoreArgs(process.argv.slice(2))
  const { parseIdentityFile } = await import('../src/lib/backup/crypto')
  const { restoreFromCipher } = await import('../src/lib/backup/restore')
  const identity = parseIdentityFile(await readFile(args.identity, 'utf8'))
  let cipher
  if (args.input) cipher = createReadStream(args.input)
  else {
    const { getEnv } = await import('../src/lib/env')
    const { getBackupS3 } = await import('../src/lib/backup/s3')
    const { GetObjectCommand } = await import('@aws-sdk/client-s3')
    const { client, bucket } = getBackupS3(getEnv())
    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: args.key as string }))
    cipher = res.Body as import('node:stream').Readable
  }
  if (!args.skipMigrate) runMigrations(args.target) // b) Migrationen des Ziels
  const res = await restoreFromCipher({ cipher, identity, targetUrl: args.target })
  console.log(
    `backup:restore: ${res.tables.length} Tabellen, ${res.rows} Zeilen wiederhergestellt ` +
      `(Stand ${res.header.createdAt}, Version ${res.header.appVersion}, letzte Migration ${res.header.lastMigration}).`,
  )
}

if (process.argv[1]?.endsWith('backup-restore.ts')) {
  main().then(
    () => process.exit(0),
    (e: unknown) => {
      console.error(e instanceof Error ? e.message : e)
      process.exit(1)
    },
  )
}
