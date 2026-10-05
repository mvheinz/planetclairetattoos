import 'server-only'

import { mkdir, open, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { PutObjectCommand } from '@aws-sdk/client-s3'

import { getEnv, type Env } from '@/lib/env'

import { STORAGE_PREFIX, uploadStaticDir } from './index'
import { getS3Client } from './s3'
import type { UploadArea } from './types'

// Bedingtes Schreiben (R-122, ARCHITEKTUR §3.3, PLAN P5.26): Beleg-PDFs werden nur geschrieben, wenn das Objekt noch
// nicht existiert – `local` mit `fs.open(…, 'wx')` (exklusiv anlegen), `s3` mit `IfNoneMatch: '*'` (bedingtes PUT;
// Antwort 412 bzw. 409, wenn es das Objekt schon gibt). Ein zweiter Schreibversuch wirft `ObjectExistsError`.

/** Nebendatei mit den Metadaten bei `STORAGE_DRIVER=local`. */
export const META_SUFFIX = '.meta.json'

export class ObjectExistsError extends Error {
  constructor(readonly key: string) {
    super(`Datei „${key}“ existiert schon und wird nie überschrieben (R-122).`)
    this.name = 'ObjectExistsError'
  }
}

export interface PutIfAbsentInput {
  area: UploadArea
  /** Präfix im Bucket, z. B. `private/invoices/2026` (bei `local` ohne Wirkung – flache Ablage je Bereich). */
  prefix?: string | null
  filename: string
  bytes: Buffer | Uint8Array
  contentType: string
  /** Objekt-Metadaten (`x-amz-meta-*`; lokal Nebendatei `<datei>.meta.json`), z. B. `invoice-number` (ARCHITEKTUR §10.4). */
  metadata?: Record<string, string>
}

function checkName(filename: string): string {
  if (!filename || /[/\\]/.test(filename) || filename.startsWith('.')) {
    throw new Error(`Ungültiger Dateiname: ${filename}`)
  }
  return filename
}

/** Speicherort: `local` → Pfad unter `STORAGE_LOCAL_DIR/<Bereich>`, `s3` → Objektschlüssel `<prefix>/<Datei>`. */
export function storedLocation(
  area: UploadArea,
  prefix: string | null | undefined,
  filename: string,
  env: Pick<Env, 'STORAGE_DRIVER' | 'STORAGE_LOCAL_DIR'> = getEnv(),
): string {
  checkName(filename)
  if (env.STORAGE_DRIVER === 'local') return path.join(uploadStaticDir(area, env), filename)
  return path.posix.join(prefix || STORAGE_PREFIX[area], filename)
}

export async function putIfAbsent(input: PutIfAbsentInput, env: Env = getEnv()): Promise<string> {
  const location = storedLocation(input.area, input.prefix, input.filename, env)
  if (env.STORAGE_DRIVER === 'local') {
    await mkdir(path.dirname(location), { recursive: true })
    let handle
    try {
      handle = await open(location, 'wx')
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'EEXIST') throw new ObjectExistsError(location)
      throw e
    }
    try {
      await handle.writeFile(input.bytes)
    } catch (e) {
      await handle.close().catch(() => undefined)
      await unlink(location).catch(() => undefined)
      throw e
    }
    await handle.close()
    if (input.metadata) await writeFile(`${location}${META_SUFFIX}`, JSON.stringify(input.metadata))
    return location
  }
  try {
    await getS3Client(env).send(
      new PutObjectCommand({
        Bucket: (input.area === 'private' ? env.S3_PRIVATE_BUCKET : env.S3_BUCKET)!,
        Key: location,
        Body: input.bytes,
        ContentType: input.contentType,
        IfNoneMatch: '*',
        ...(input.metadata ? { Metadata: input.metadata } : {}),
      }),
    )
  } catch (e) {
    const status = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
    const name = (e as { name?: string }).name
    if (status === 412 || status === 409 || name === 'PreconditionFailed') {
      throw new ObjectExistsError(location)
    }
    throw e
  }
  return location
}
