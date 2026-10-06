import 'server-only'

import { createWriteStream } from 'node:fs'
import { mkdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { Readable } from 'node:stream'

import { CopyObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'

import { hashingPassThrough, encryptStream } from './crypto'
import { createDumpStream, type DumpResult } from './dump'
import { dailyKey } from './format'

// Ein Codepfad für Vercel (Route `/api/cron/backup`) und Docker/lokal (`pnpm backup:run`, ARCHITEKTUR §10.1 BK-5).

/** Obergrenze des komprimierten Chiffrats (§10.3 Nr. 4): darüber Abbruch mit Alarm A12. */
export const MAX_BACKUP_BYTES = 512 * 1024 * 1024
export const UPLOAD_PART_SIZE = 8 * 1024 * 1024

export type BackupTarget =
  { kind: 'file'; path: string } | { kind: 's3'; client: S3Client; bucket: string }

export interface RunBackupOptions {
  connectionString: string
  recipient: string
  appVersion: string
  now: Date
  target: BackupTarget
}

export interface BackupResult {
  /** Schlüssel (S3) bzw. Dateipfad (lokal). */
  key: string
  sizeBytes: number
  sha256: string
  tables: number
  rows: number
  durationMs: number
  lastMigration: string | null
  appVersion: string
  createdAt: string
}

/** Lokales Ziel: `--to=file:<pfad>` – ein Verzeichnis (oder Pfad mit `/` am Ende) bekommt den üblichen Schlüssel darunter. */
async function localPath(target: string, now: Date): Promise<string> {
  const isDir =
    target.endsWith('/') ||
    (await stat(target).then(
      (s) => s.isDirectory(),
      () => false,
    ))
  return isDir ? path.join(target, dailyKey(now)) : target
}

export async function runBackup(opts: RunBackupOptions): Promise<BackupResult> {
  const started = Date.now()
  const { stream: plain, summary } = createDumpStream({
    connectionString: opts.connectionString,
    appVersion: opts.appVersion,
    now: opts.now,
  })
  const cipher = await encryptStream(plain, opts.recipient)
  const hashing = hashingPassThrough(MAX_BACKUP_BYTES)
  cipher.on('error', (e) => hashing.stream.destroy(e))
  cipher.pipe(hashing.stream)

  let key: string
  let dump: DumpResult
  if (opts.target.kind === 'file') {
    key = await localPath(opts.target.path, opts.now)
    await mkdir(path.dirname(key), { recursive: true })
    await pipeline(hashing.stream, createWriteStream(key))
    dump = await summary
  } else {
    key = dailyKey(opts.now)
    const { client, bucket } = opts.target
    const upload = new Upload({
      client,
      partSize: UPLOAD_PART_SIZE,
      queueSize: 2,
      params: {
        Bucket: bucket,
        Key: key,
        Body: hashing.stream as Readable,
        ContentType: 'application/octet-stream',
      },
    })
    await upload.done()
    dump = await summary
  }
  const { sha256, sizeBytes } = hashing.result()

  if (opts.target.kind === 's3') {
    const { client, bucket } = opts.target
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    if (head.ContentLength !== sizeBytes) {
      throw new Error(`Backup-Größe passt nicht: ${head.ContentLength} statt ${sizeBytes} Bytes`)
    }
    // Metadaten (§10.3 Nr. 5): der SHA-256 steht erst nach dem Hochladen fest → Ersetzen per Kopie auf sich selbst.
    await client.send(
      new CopyObjectCommand({
        Bucket: bucket,
        Key: key,
        CopySource: `${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`,
        MetadataDirective: 'REPLACE',
        ContentType: 'application/octet-stream',
        Metadata: {
          sha256,
          'last-migration': dump.header.lastMigration ?? '',
          'app-version': dump.header.appVersion,
        },
      }),
    )
  }

  return {
    key,
    sizeBytes,
    sha256,
    tables: dump.tables.length,
    rows: dump.rows,
    durationMs: Date.now() - started,
    lastMigration: dump.header.lastMigration,
    appVersion: dump.header.appVersion,
    createdAt: dump.header.createdAt,
  }
}
