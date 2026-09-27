import 'server-only'

import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'

import { getEnv, type Env } from '@/lib/env'

import { localStorageRoot } from './index'
import { getS3Client } from './s3'
import type { SystemFileStore } from './types'

// Systemdateien ohne Datenbank (ARCHITEKTUR §3.3, §9.6): `local` → `<STORAGE_LOCAL_DIR>/<key>`,
// `s3` → Bucket S3_PRIVATE_BUCKET, Präfix `system/`.

export const SYSTEM_PREFIX = 'system'
const KEY_RE = /^[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)*\.json$/

function checkKey(key: string): string {
  if (!KEY_RE.test(key) || key.includes('..')) {
    throw new Error(`Ungültiger Schlüssel für eine Systemdatei: ${key}`)
  }
  return key
}

function localStore(env: Env): SystemFileStore {
  const root = localStorageRoot(env)
  const file = (key: string) => path.join(root, checkKey(key))
  return {
    driver: 'local',
    async readJson<T>(key: string): Promise<T | null> {
      try {
        return JSON.parse(await readFile(file(key), 'utf8')) as T
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
        throw e
      }
    },
    async writeJson(key, value) {
      const target = file(key)
      await mkdir(path.dirname(target), { recursive: true })
      // Atomar ersetzen: erst in eine Nachbardatei schreiben, dann umbenennen.
      const tmp = `${target}.${process.pid}.tmp`
      await writeFile(tmp, `${JSON.stringify(value)}\n`, 'utf8')
      await rename(tmp, target)
    },
    async remove(key) {
      await rm(file(key), { force: true })
    },
  }
}

function s3Store(env: Env): SystemFileStore {
  const client = getS3Client(env)
  const Bucket = env.S3_PRIVATE_BUCKET as string
  const objectKey = (key: string) => `${SYSTEM_PREFIX}/${checkKey(key)}`
  return {
    driver: 's3',
    async readJson<T>(key: string): Promise<T | null> {
      try {
        const res = await client.send(new GetObjectCommand({ Bucket, Key: objectKey(key) }))
        const text = (await res.Body?.transformToString('utf8')) ?? ''
        return text ? (JSON.parse(text) as T) : null
      } catch (e) {
        const err = e as { name?: string; $metadata?: { httpStatusCode?: number } }
        if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) return null
        throw e
      }
    },
    async writeJson(key, value) {
      await client.send(
        new PutObjectCommand({
          Bucket,
          Key: objectKey(key),
          Body: JSON.stringify(value),
          ContentType: 'application/json',
          CacheControl: 'no-store',
        }),
      )
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket, Key: objectKey(key) }))
    },
  }
}

export function createSystemFileStore(env: Env): SystemFileStore {
  return env.STORAGE_DRIVER === 's3' ? s3Store(env) : localStore(env)
}

let instance: SystemFileStore | undefined

export function getSystemFiles(): SystemFileStore {
  if (!instance) instance = createSystemFileStore(getEnv())
  return instance
}

/** Nur in Tests benutzen. */
export function __setSystemFilesForTests(store?: SystemFileStore): void {
  instance = store
}

export function readJson<T = unknown>(key: string): Promise<T | null> {
  return getSystemFiles().readJson<T>(key)
}

export function writeJson(key: string, value: unknown): Promise<void> {
  return getSystemFiles().writeJson(key, value)
}
