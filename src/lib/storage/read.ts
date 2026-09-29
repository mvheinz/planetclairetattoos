import 'server-only'

import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { GetObjectCommand } from '@aws-sdk/client-s3'

import { getEnv, type Env } from '@/lib/env'

import { STORAGE_PREFIX, uploadStaticDir } from './index'
import type { UploadArea } from './types'
import { getS3Client } from './s3'

// Serverseitiges Lesen einer öffentlichen Mediendatei (ARCHITEKTUR §3.3), z. B. für die OG-Bilder (P3.14): `local` →
// Datei unter `STORAGE_LOCAL_DIR/media`, `s3` → Objekt `media/<Dateiname>` im öffentlichen Bucket (eigener Speicher,
// kein fremder Host). Nie über die öffentliche URL der Website.

/** Liest `filename` aus dem Bereich `media`; `null`, wenn die Datei fehlt oder der Name unzulässig ist. */
export function readMediaFile(
  filename: string,
  prefix: string | null | undefined = STORAGE_PREFIX.media,
  env: Env = getEnv(),
): Promise<Buffer | null> {
  return readStoredFile('media', filename, prefix, env)
}

/**
 * Liest eine gespeicherte Upload-Datei serverseitig (P4.12/P4.13: Rechtstext-PDFs aus `documents`, Beleg-PDFs aus
 * `private-uploads` als Mail-Anhang). `local` → `STORAGE_LOCAL_DIR/<Bereich>/<Dateiname>`, `s3` → Objekt
 * `<prefix>/<Dateiname>` im Bucket des Bereichs (privat: `S3_PRIVATE_BUCKET`). `null`, wenn die Datei fehlt.
 */
export async function readStoredFile(
  area: UploadArea,
  filename: string,
  prefix: string | null | undefined,
  env: Env = getEnv(),
): Promise<Buffer | null> {
  if (!filename || filename.includes('/') || filename.includes('\\') || filename.startsWith('.'))
    return null
  if (env.STORAGE_DRIVER === 'local') {
    const dir = uploadStaticDir(area, env)
    const file = path.resolve(dir, filename)
    if (!file.startsWith(dir + path.sep)) return null
    return readFile(file).catch(() => null)
  }
  try {
    const res = await getS3Client(env).send(
      new GetObjectCommand({
        Bucket: (area === 'private' ? env.S3_PRIVATE_BUCKET : env.S3_BUCKET)!,
        Key: path.posix.join(prefix || STORAGE_PREFIX[area], filename),
      }),
    )
    const bytes = await res.Body?.transformToByteArray()
    return bytes ? Buffer.from(bytes) : null
  } catch {
    return null
  }
}
