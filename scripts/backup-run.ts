// Datenbank-Backup erzeugen (ARCHITEKTUR §10.3): pnpm backup:run [--to=file:<pfad>|s3] [--recipient=age1…]
// Ohne `--to`: `s3` (Backup-Bucket aus BACKUP_S3_*). Derselbe Code wie die Route /api/cron/backup (BK-5).
import 'dotenv/config'

import { spawnSync } from 'node:child_process'

export interface BackupRunArgs {
  to: { kind: 'file'; path: string } | { kind: 's3' }
  recipient: string | null
}

export function parseBackupRunArgs(argv: readonly string[]): BackupRunArgs {
  let to: BackupRunArgs['to'] = { kind: 's3' }
  let recipient: string | null = null
  for (const a of argv) {
    if (a.startsWith('--to=')) {
      const v = a.slice('--to='.length)
      if (v === 's3') to = { kind: 's3' }
      else if (v.startsWith('file:') && v.length > 5) to = { kind: 'file', path: v.slice(5) }
      else throw new Error('--to erwartet file:<pfad> oder s3.')
    } else if (a.startsWith('--recipient=')) recipient = a.slice('--recipient='.length)
    else throw new Error(`Unbekannte Option: ${a}`)
  }
  return { to, recipient }
}

function appVersion(sha: string | undefined): string {
  if (sha) return sha.slice(0, 7)
  const r = spawnSync('git', ['rev-parse', '--short=7', 'HEAD'], { encoding: 'utf8' })
  return r.status === 0 ? r.stdout.trim() : 'dev'
}

async function main(): Promise<void> {
  const args = parseBackupRunArgs(process.argv.slice(2))
  const { getEnv } = await import('../src/lib/env')
  const { runBackup } = await import('../src/lib/backup/run')
  const { getBackupS3 } = await import('../src/lib/backup/s3')
  const env = getEnv()
  const recipient = args.recipient ?? env.BACKUP_AGE_RECIPIENT
  if (!recipient) throw new Error('Empfänger fehlt: --recipient=age1… oder BACKUP_AGE_RECIPIENT.')
  const target = args.to.kind === 'file' ? args.to : { kind: 's3' as const, ...getBackupS3(env) }
  const res = await runBackup({
    connectionString: env.DATABASE_URL_UNPOOLED || env.DATABASE_URL,
    recipient,
    appVersion: appVersion(env.VERCEL_GIT_COMMIT_SHA),
    now: new Date(),
    target,
  })
  console.log(
    `backup:run: ${res.key} · ${res.tables} Tabellen, ${res.rows} Zeilen, ${res.sizeBytes} Bytes, ` +
      `sha256 ${res.sha256}, ${res.durationMs} ms`,
  )
}

if (process.argv[1]?.endsWith('backup-run.ts')) {
  main().then(
    () => process.exit(0),
    (e: unknown) => {
      console.error(e instanceof Error ? e.message : e)
      process.exit(1)
    },
  )
}
