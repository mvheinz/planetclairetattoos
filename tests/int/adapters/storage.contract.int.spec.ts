import { mkdtemp, readFile, rm } from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { parseEnv } from '@/lib/env'
import {
  CACHE_HEADERS,
  PRIVATE_URL_TTL_SECONDS,
  cacheClassFor,
  invoicePrefix,
  uploadStaticDir,
} from '@/lib/storage'
import { signedPrivateUrl } from '@/lib/storage/signed'
import { createSystemFileStore } from '@/lib/storage/systemFiles'

import { createStorageHarness, type StorageHarness } from '../helpers/storageHarness'

// P1.8 – Kontrakttest Speicher (ARCHITEKTUR §3.1 Nr. 3, §3.3; R-136, DM-PRIV-01 vorbereitet, Spike B-02).
// `local` läuft immer. `s3` läuft gegen MinIO (docker compose --profile s3) bzw. einen MinIO-kompatiblen Dienst unter
// S3_TEST_ENDPOINT (Standard http://127.0.0.1:9000); ist keiner erreichbar, wird der Block mit Hinweis übersprungen.

const S3_TEST = {
  endpoint: process.env.S3_TEST_ENDPOINT ?? 'http://127.0.0.1:9000',
  accessKeyId: process.env.S3_TEST_ACCESS_KEY_ID ?? 'minioadmin',
  secretAccessKey: process.env.S3_TEST_SECRET_ACCESS_KEY ?? 'minioadmin',
  bucket: 'pct-media-dev',
  privateBucket: 'pct-private-dev',
}

async function reachable(endpoint: string): Promise<boolean> {
  const u = new URL(endpoint)
  if (!['127.0.0.1', 'localhost', '::1'].includes(u.hostname)) return false // nur lokale Nachbildungen
  return new Promise((resolve) => {
    const socket = net.connect({ host: u.hostname, port: Number(u.port || 80) })
    socket.setTimeout(1000)
    socket.once('connect', () => (socket.destroy(), resolve(true)))
    socket.once('error', () => resolve(false))
    socket.once('timeout', () => (socket.destroy(), resolve(false)))
  })
}

const s3Available = await reachable(S3_TEST.endpoint)
if (!s3Available) {
  console.warn(
    `[storage.contract] s3-Teil übersprungen: kein MinIO unter ${S3_TEST.endpoint} (docker compose --profile s3 up -d).`,
  )
}

async function png(): Promise<Buffer> {
  return sharp({ create: { width: 8, height: 8, channels: 3, background: '#c0ffee' } })
    .png()
    .toBuffer()
}
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')

const file = (data: Buffer, name: string, mimetype: string) => ({
  data,
  name,
  mimetype,
  size: data.length,
})

describe('Speicher – Bausteine (alle Treiber)', () => {
  it('local: staticDir liegt unter STORAGE_LOCAL_DIR und nicht unter public/', () => {
    const env = parseEnv({ ...process.env, STORAGE_LOCAL_DIR: '.data' })
    for (const area of ['media', 'documents', 'private'] as const) {
      const dir = uploadStaticDir(area, env)
      expect(dir).toBe(path.resolve(process.cwd(), '.data', area))
      expect(dir.includes(`${path.sep}public${path.sep}`)).toBe(false)
    }
  })

  it('Cache-Klassen laut ARCHITEKTUR §3.3', () => {
    expect(cacheClassFor('media', { id: 1 })).toBe('immutable')
    expect(cacheClassFor('media', { id: 1, seed: true })).toBe('short')
    expect(cacheClassFor('media', { id: 1, showsPerson: 'customer' })).toBe('short')
    expect(cacheClassFor('media', { id: 1, restricted: true })).toBe('private')
    expect(cacheClassFor('media', undefined)).toBe('short')
    expect(cacheClassFor('private', { id: 1 })).toBe('private')
    expect(CACHE_HEADERS.short['Cache-Control']).not.toContain('immutable')
    expect(CACHE_HEADERS.private['Cache-Control']).toBe('private, no-store')
  })

  it('Rechnungs-Präfix je Dokument: private/invoices/<Jahr>', () => {
    expect(invoicePrefix(2026)).toBe('private/invoices/2026')
  })

  it('local: signierte URLs gibt es nicht (Auslieferung nur über die Dateiroute)', async () => {
    const env = parseEnv({ ...process.env, STORAGE_DRIVER: 'local' })
    expect(await signedPrivateUrl('private/x.pdf', { env })).toBeNull()
  })
})

describe('Speicher – Systemdateien local', () => {
  let dir: string
  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'pc-sysfiles-'))
  })
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('readJson/writeJson unter <STORAGE_LOCAL_DIR>/<key>, fehlend → null, ungültiger Schlüssel → Fehler', async () => {
    const store = createSystemFileStore(
      parseEnv({ ...process.env, STORAGE_DRIVER: 'local', STORAGE_LOCAL_DIR: dir }),
    )
    expect(await store.readJson('job-alarm.json')).toBeNull()
    await store.writeJson('job-alarm.json', { nextDueAt: '2026-10-15T08:00:00.000Z' })
    expect(await store.readJson('job-alarm.json')).toEqual({
      nextDueAt: '2026-10-15T08:00:00.000Z',
    })
    expect(JSON.parse(await readFile(path.join(dir, 'job-alarm.json'), 'utf8'))).toEqual({
      nextDueAt: '2026-10-15T08:00:00.000Z',
    })
    await expect(store.writeJson('../ausbruch.json', {})).rejects.toThrow(/Ungültiger Schlüssel/)
    await store.remove('job-alarm.json')
    expect(await store.readJson('job-alarm.json')).toBeNull()
  })
})

describe('Speicher – Payload-Uploads mit STORAGE_DRIVER=local', () => {
  let h: StorageHarness
  let dir: string
  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'pc-storage-'))
    h = await createStorageHarness('local', { STORAGE_DRIVER: 'local', STORAGE_LOCAL_DIR: dir })
  })
  afterAll(async () => {
    await h?.close()
    await rm(dir, { recursive: true, force: true })
  })

  it('Medien: Datei in <dir>/media, Dateiroute öffentlich mit immutable; Seed-Medien kurz gecacht', async () => {
    const data = await png()
    const doc = await h.payload.create({
      collection: 'media',
      data: { alt: 'Schale blau' } as never,
      file: file(data, 'schale.png', 'image/png'),
      overrideAccess: true,
    })
    expect(doc.url).toMatch(/^\/api\/media\/file\//) // eigene Dateiroute, kein fremder Host
    expect(await readFile(path.join(dir, 'media', doc.filename as string))).toEqual(data)
    const res = await h.request(`/media/file/${doc.filename}`)
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe(CACHE_HEADERS.immutable['Cache-Control'])
    expect(Buffer.from(await res.arrayBuffer())).toEqual(data)

    const seedDoc = await h.payload.create({
      collection: 'media',
      data: { alt: 'Beispiel', seed: true } as never,
      file: file(data, 'beispiel.png', 'image/png'),
      overrideAccess: true,
    })
    const seedRes = await h.request(`/media/file/${seedDoc.filename}`)
    expect(seedRes.status).toBe(200)
    expect(seedRes.headers.get('cache-control')).toBe('public, max-age=300')
  })

  it('Gesperrte Medien: anonym nicht abrufbar, Verwaltung ohne geteilten Cache', async () => {
    const doc = await h.payload.create({
      collection: 'media',
      data: { alt: 'Gesperrt', restricted: true } as never,
      file: file(await png(), 'gesperrt.png', 'image/png'),
      overrideAccess: true,
    })
    expect([401, 403, 404]).toContain((await h.request(`/media/file/${doc.filename}`)).status)
    const res = await h.request(`/media/file/${doc.filename}`, await h.adminHeaders())
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('private, no-store')
  })

  it('R-136: private Datei ohne Anmeldung 403, mit Verwaltungs-Sitzung 200 und private, no-store', async () => {
    const doc = await h.payload.create({
      collection: 'private-uploads' as 'media',
      data: { note: 'Beleg' } as never,
      file: file(PDF, 'beleg.pdf', 'application/pdf'),
      overrideAccess: true,
    })
    expect(await readFile(path.join(dir, 'private', doc.filename as string))).toEqual(PDF)
    const anon = await h.request(`/private-uploads/file/${doc.filename}`)
    expect(anon.status).toBe(403)
    const admin = await h.request(`/private-uploads/file/${doc.filename}`, await h.adminHeaders())
    expect(admin.status).toBe(200)
    expect(admin.headers.get('cache-control')).toBe('private, no-store')
    expect(Buffer.from(await admin.arrayBuffer())).toEqual(PDF)
  })
})

describe.skipIf(!s3Available)('Speicher – STORAGE_DRIVER=s3 gegen MinIO (Spike B-02)', () => {
  let h: StorageHarness
  let s3: S3Client
  const overrides = {
    STORAGE_DRIVER: 's3',
    S3_ENDPOINT: S3_TEST.endpoint,
    S3_REGION: 'us-east-1',
    S3_BUCKET: S3_TEST.bucket,
    S3_PRIVATE_BUCKET: S3_TEST.privateBucket,
    S3_ACCESS_KEY_ID: S3_TEST.accessKeyId,
    S3_SECRET_ACCESS_KEY: S3_TEST.secretAccessKey,
    S3_FORCE_PATH_STYLE: 'true',
  }

  beforeAll(async () => {
    s3 = new S3Client({
      endpoint: S3_TEST.endpoint,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: { accessKeyId: S3_TEST.accessKeyId, secretAccessKey: S3_TEST.secretAccessKey },
    })
    for (const Bucket of [S3_TEST.bucket, S3_TEST.privateBucket]) {
      try {
        await s3.send(new HeadBucketCommand({ Bucket }))
      } catch {
        await s3.send(new CreateBucketCommand({ Bucket }))
      }
    }
    h = await createStorageHarness('s3', overrides)
  })
  afterAll(async () => {
    await h?.close()
  })

  it('zwei Instanzen: Medien im öffentlichen Bucket unter media/, Auslieferung über die App-Dateiroute', async () => {
    const data = await png()
    const doc = await h.payload.create({
      collection: 'media',
      data: { alt: 'Schale grün' } as never,
      file: file(data, 'schale-s3.png', 'image/png'),
      overrideAccess: true,
    })
    const head = await s3.send(
      new HeadObjectCommand({ Bucket: S3_TEST.bucket, Key: `media/${doc.filename}` }),
    )
    expect(head.ContentLength).toBe(data.length)
    const res = await h.request(`/media/file/${doc.filename}`)
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe(CACHE_HEADERS.immutable['Cache-Control'])
    expect(Buffer.from(await res.arrayBuffer())).toEqual(data)
    // Bucket ist nicht öffentlich.
    const direct = await fetch(`${S3_TEST.endpoint}/${S3_TEST.bucket}/media/${doc.filename}`)
    expect(direct.status).toBe(403)
  })

  it('R-136/DM-PRIV-01: private Datei unter private/invoices/<Jahr>/ nur per signierter URL (≤ 300 s), nach Ablauf 403', async () => {
    const doc = await h.payload.create({
      collection: 'private-uploads' as 'media',
      data: { note: 'Rechnung', prefix: invoicePrefix(2026) } as never,
      file: file(PDF, 'RE-2026-0001.pdf', 'application/pdf'),
      overrideAccess: true,
    })
    const key = `private/invoices/2026/${doc.filename}`
    expect((doc as { prefix?: string }).prefix).toBe('private/invoices/2026')
    await s3.send(new HeadObjectCommand({ Bucket: S3_TEST.privateBucket, Key: key }))
    await expect(
      s3.send(new HeadObjectCommand({ Bucket: S3_TEST.bucket, Key: key })),
    ).rejects.toBeTruthy()

    // Ohne Anmeldung: 403, keine Umleitung.
    const anon = await h.request(`/private-uploads/file/${doc.filename}`)
    expect(anon.status).toBe(403)

    // Verwaltung: Umleitung auf eine signierte URL mit höchstens 300 s Gültigkeit.
    const admin = await h.request(`/private-uploads/file/${doc.filename}`, await h.adminHeaders())
    expect(admin.status).toBe(302)
    const signed = new URL(admin.headers.get('location') as string)
    expect(signed.pathname).toBe(`/${S3_TEST.privateBucket}/${key}`)
    expect(Number(signed.searchParams.get('X-Amz-Expires'))).toBeLessThanOrEqual(
      PRIVATE_URL_TTL_SECONDS,
    )
    const ok = await fetch(signed)
    expect(ok.status).toBe(200)
    expect(Buffer.from(await ok.arrayBuffer())).toEqual(PDF)

    // Ohne Signatur: 403.
    expect((await fetch(`${S3_TEST.endpoint}/${S3_TEST.privateBucket}/${key}`)).status).toBe(403)

    // Abgelaufen: vor 301 s mit 300 s Gültigkeit signiert → 403.
    const expired = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: S3_TEST.privateBucket, Key: key }),
      { expiresIn: PRIVATE_URL_TTL_SECONDS, signingDate: new Date(Date.now() - 301_000) },
    )
    expect((await fetch(expired)).status).toBe(403)

    // Server-Helfer liefert ebenfalls höchstens 300 s.
    const helper = new URL((await signedPrivateUrl(key, { env: h.env, expiresIn: 3600 })) as string)
    expect(helper.searchParams.get('X-Amz-Expires')).toBe('300')
  })

  it('Systemdateien: s3 → privater Bucket, Präfix system/', async () => {
    const store = createSystemFileStore(h.env)
    await store.writeJson('job-alarm.json', { nextDueAt: null })
    expect(await store.readJson('job-alarm.json')).toEqual({ nextDueAt: null })
    await s3.send(
      new HeadObjectCommand({ Bucket: S3_TEST.privateBucket, Key: 'system/job-alarm.json' }),
    )
    await store.remove('job-alarm.json')
    expect(await store.readJson('job-alarm.json')).toBeNull()
  })
})
