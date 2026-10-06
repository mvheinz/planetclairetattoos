import 'server-only'

import { S3Client } from '@aws-sdk/client-s3'

import type { Env } from '@/lib/env'
import { ConfigError } from '@/lib/errors'

// Backup-Bucket (`pct-backups`, ARCHITEKTUR §10.1 BK-3): eigene Zugangsdaten `BACKUP_S3_*`, gleicher Endpunkt (R2-EU).

type BackupS3Env = Pick<
  Env,
  | 'S3_ENDPOINT'
  | 'S3_REGION'
  | 'S3_FORCE_PATH_STYLE'
  | 'BACKUP_S3_BUCKET'
  | 'BACKUP_S3_ACCESS_KEY_ID'
  | 'BACKUP_S3_SECRET_ACCESS_KEY'
>

export function getBackupS3(env: BackupS3Env): { client: S3Client; bucket: string } {
  const missing = (
    [
      'S3_ENDPOINT',
      'BACKUP_S3_BUCKET',
      'BACKUP_S3_ACCESS_KEY_ID',
      'BACKUP_S3_SECRET_ACCESS_KEY',
    ] as const
  ).filter((k) => !env[k])
  if (missing.length > 0) throw new ConfigError(`Backup nach S3: es fehlen ${missing.join(', ')}.`)
  return {
    bucket: env.BACKUP_S3_BUCKET as string,
    client: new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION || 'auto',
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: env.BACKUP_S3_ACCESS_KEY_ID as string,
        secretAccessKey: env.BACKUP_S3_SECRET_ACCESS_KEY as string,
      },
    }),
  }
}
