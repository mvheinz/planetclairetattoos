import 'server-only'

import { S3Client, type S3ClientConfig } from '@aws-sdk/client-s3'

import type { Env } from '@/lib/env'
import { ConfigError } from '@/lib/errors'

// S3-kompatibler Speicher (Cloudflare R2 in Produktion, MinIO lokal; ARCHITEKTUR §3.3).

type S3Env = Pick<
  Env,
  | 'S3_ENDPOINT'
  | 'S3_REGION'
  | 'S3_BUCKET'
  | 'S3_PRIVATE_BUCKET'
  | 'S3_ACCESS_KEY_ID'
  | 'S3_SECRET_ACCESS_KEY'
  | 'S3_FORCE_PATH_STYLE'
>

/** Prüft, dass alle Werte für `STORAGE_DRIVER=s3` gesetzt sind; nennt alle fehlenden auf einmal. */
export function assertS3Env(env: S3Env): Required<S3Env> {
  const required = [
    'S3_ENDPOINT',
    'S3_BUCKET',
    'S3_PRIVATE_BUCKET',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
  ] as const
  const missing = required.filter((k) => !env[k])
  if (missing.length > 0) {
    throw new ConfigError(
      `STORAGE_DRIVER=s3, aber es fehlen: ${missing.join(', ')}. Bitte in der Umgebung setzen oder STORAGE_DRIVER=local verwenden.`,
    )
  }
  return env as Required<S3Env>
}

/** Client-Konfiguration für `@aws-sdk/client-s3` und `@payloadcms/storage-s3`. */
export function s3ClientConfig(env: S3Env): S3ClientConfig {
  const e = assertS3Env(env)
  return {
    endpoint: e.S3_ENDPOINT,
    region: e.S3_REGION || 'auto',
    forcePathStyle: e.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: e.S3_ACCESS_KEY_ID as string,
      secretAccessKey: e.S3_SECRET_ACCESS_KEY as string,
    },
  }
}

const clients = new Map<string, S3Client>()

/** Ein Client je Endpunkt/Schlüssel und Prozess. */
export function getS3Client(env: S3Env): S3Client {
  const cfg = s3ClientConfig(env)
  const key = `${String(cfg.endpoint)}|${env.S3_ACCESS_KEY_ID}`
  let client = clients.get(key)
  if (!client) {
    client = new S3Client(cfg)
    clients.set(key, client)
  }
  return client
}
