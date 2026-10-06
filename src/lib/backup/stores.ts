import 'server-only'

import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3'

import type { Env } from '@/lib/env'
import { META_SUFFIX } from '@/lib/storage/putIfAbsent'

import { getS3Client } from '@/lib/storage/s3'
import { localStorageRoot } from '@/lib/storage'

// Speicher-Abstraktionen des Datei-Spiegels (ARCHITEKTUR §10.4): Quelle (App-Buckets bzw. `.data/`) lesen, Spiegel
// (Backup-Bucket bzw. Ordner) lesen/schreiben/löschen. S3 in Produktion, Ordner lokal und in Tests.

export interface ObjectInfo {
  key: string
  size: number
  lastModified: Date
}

/** Bereiche des Spiegels (§10.2): `private` täglich, `media` (Medien und öffentliche PDFs) wöchentlich. */
export type MirrorArea = 'private' | 'media'

export interface SourceStore {
  list(area: MirrorArea): Promise<ObjectInfo[]>
  get(key: string): Promise<Buffer>
}

export interface MirrorStore {
  list(prefix: string): Promise<ObjectInfo[]>
  put(key: string, body: Buffer): Promise<void>
  delete(key: string): Promise<void>
}

export const sha256Key = (sourceKey: string): string =>
  createHash('sha256').update(sourceKey).digest('hex')

// ---------- S3 ----------

async function listS3(client: S3Client, bucket: string, prefix: string): Promise<ObjectInfo[]> {
  const out: ObjectInfo[] = []
  let token: string | undefined
  do {
    const res = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }),
    )
    for (const o of res.Contents ?? []) {
      if (o.Key)
        out.push({ key: o.Key, size: o.Size ?? 0, lastModified: o.LastModified ?? new Date(0) })
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (token)
  return out
}

/** Quelle `s3`: privater Bucket (`private/`) bzw. öffentlicher Bucket (`media/`, `documents/`). */
export function s3Source(env: Env): SourceStore {
  const client = getS3Client(env)
  const privateBucket = env.S3_PRIVATE_BUCKET as string
  const publicBucket = env.S3_BUCKET as string
  const bucketOf = (key: string) => (key.startsWith('private/') ? privateBucket : publicBucket)
  return {
    async list(area) {
      if (area === 'private') return listS3(client, privateBucket, 'private/')
      return [
        ...(await listS3(client, publicBucket, 'media/')),
        ...(await listS3(client, publicBucket, 'documents/')),
      ]
    },
    async get(key) {
      const res = await client.send(new GetObjectCommand({ Bucket: bucketOf(key), Key: key }))
      return Buffer.from(await res.Body!.transformToByteArray())
    },
  }
}

/** Spiegel im Backup-Bucket (eigene Zugangsdaten, BK-3). */
export function s3Mirror(client: S3Client, bucket: string): MirrorStore {
  return {
    list: (prefix) => listS3(client, bucket, prefix),
    async put(key, body) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: 'application/octet-stream',
        }),
      )
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    },
  }
}

// ---------- Ordner ----------

async function walk(dir: string, base: string): Promise<ObjectInfo[]> {
  const out: ObjectInfo[] = []
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return out
    throw e
  }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...(await walk(full, base)))
    else if (e.isFile()) {
      const s = await stat(full)
      out.push({
        key: path.relative(base, full).split(path.sep).join('/'),
        size: s.size,
        lastModified: s.mtime,
      })
    }
  }
  return out
}

/** Quelle `local`: `<STORAGE_LOCAL_DIR>/private` → `private/<datei>`, `media` und `documents` entsprechend. Nebendateien `.meta.json` zählen nicht. */
export function localSource(env: Pick<Env, 'STORAGE_LOCAL_DIR'>): SourceStore {
  const root = localStorageRoot(env)
  return {
    async list(area) {
      const dirs = area === 'private' ? ['private'] : ['media', 'documents']
      const out: ObjectInfo[] = []
      for (const d of dirs) out.push(...(await walk(path.join(root, d), root)))
      return out.filter((o) => !o.key.endsWith(META_SUFFIX))
    },
    get: (key) => readFile(path.join(root, key)),
  }
}

/** Spiegel in einem Ordner (lokal, Docker ohne S3, Tests). */
export function dirMirror(dir: string): MirrorStore {
  const file = (key: string) => {
    if (key.includes('..')) throw new Error('Ungültiger Spiegel-Schlüssel')
    return path.join(dir, key)
  }
  return {
    async list(prefix) {
      return (await walk(dir, dir)).filter((o) => o.key.startsWith(prefix))
    },
    async put(key, body) {
      await mkdir(path.dirname(file(key)), { recursive: true })
      await writeFile(file(key), body)
    },
    async delete(key) {
      await rm(file(key), { force: true })
    },
  }
}
