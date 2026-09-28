import 'server-only'

import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { GetObjectCommand } from '@aws-sdk/client-s3'

import { getEnv, type Env } from '@/lib/env'

import { STORAGE_PREFIX, uploadStaticDir } from './index'
import { getS3Client } from './s3'

// Serverseitiges Lesen einer öffentlichen Mediendatei (ARCHITEKTUR §3.3), z. B. für die OG-Bilder (P3.14): `local` →
// Datei unter `STORAGE_LOCAL_DIR/media`, `s3` → Objekt `media/<Dateiname>` im öffentlichen Bucket (eigener Speicher,
// kein fremder Host). Nie über die öffentliche URL der Website.

/** Liest `filename` aus dem Bereich `media`; `null`, wenn die Datei fehlt oder der Name unzulässig ist. */
export async function readMediaFile(
  filename: string,
  prefix: string | null | undefined = STORAGE_PREFIX.media,
  env: Env = getEnv(),
): Promise<Buffer | null> {
  if (!filename || filename.includes('/') || filename.includes('\\') || filename.startsWith('.'))
    return null
  if (env.STORAGE_DRIVER === 'local') {
    const dir = uploadStaticDir('media', env)
    const file = path.resolve(dir, filename)
    if (!file.startsWith(dir + path.sep)) return null
    return readFile(file).catch(() => null)
  }
  try {
    const res = await getS3Client(env).send(
      new GetObjectCommand({
        Bucket: env.S3_BUCKET!,
        Key: path.posix.join(prefix || STORAGE_PREFIX.media, filename),
      }),
    )
    const bytes = await res.Body?.transformToByteArray()
    return bytes ? Buffer.from(bytes) : null
  } catch {
    return null
  }
}
