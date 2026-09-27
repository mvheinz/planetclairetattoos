import 'server-only'

import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import { getEnv, type Env } from '@/lib/env'

import { PRIVATE_URL_TTL_SECONDS } from './index'
import { getS3Client } from './s3'

// Signierte Download-URLs für private Dateien (R-136, DATENMODELL §6.4). Die Payload-Dateiroute von
// `private-uploads` leitet bei `s3` selbst auf eine solche URL um; diese Funktion dient Server-Code (z. B. Admin-Links).

/**
 * Signierte URL (höchstens 300 s gültig) für einen Objekt-Schlüssel im privaten Bucket, z. B.
 * `private/invoices/2026/RE-2026-0001.pdf`. Bei `local` gibt es keine signierten URLs → `null`
 * (Auslieferung nur über die Payload-Dateiroute mit Admin-Sitzung).
 */
export async function signedPrivateUrl(
  key: string,
  options: { expiresIn?: number; env?: Env } = {},
): Promise<string | null> {
  const env = options.env ?? getEnv()
  if (env.STORAGE_DRIVER !== 's3') return null
  const expiresIn = Math.min(options.expiresIn ?? PRIVATE_URL_TTL_SECONDS, PRIVATE_URL_TTL_SECONDS)
  const command = new GetObjectCommand({ Bucket: env.S3_PRIVATE_BUCKET, Key: key })
  return getSignedUrl(getS3Client(env), command, { expiresIn })
}
