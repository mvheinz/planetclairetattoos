import 'server-only'

import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'

import { s3Storage, type S3StorageOptions } from '@payloadcms/storage-s3'
import type { CollectionConfig, Plugin } from 'payload'

import { isAdminRequest } from '@/access'
import { getEnv, type Env } from '@/lib/env'
import { isMediaPubliclyVisible } from '@/lib/tattoo/visibility'

import { applyCacheHeaders, cacheClassFor, modifyResponseHeadersFor } from './headers'
import { s3ClientConfig } from './s3'
import { UPLOAD_AREA_COLLECTION, type UploadArea } from './types'

export { CACHE_HEADERS, cacheClassFor } from './headers'
export {
  UPLOAD_AREA_COLLECTION,
  type CacheClass,
  type StorageDriver,
  type UploadArea,
} from './types'

// Speicher-Konfiguration der Payload-Uploads (ARCHITEKTUR §3.3). Auswahl nur über STORAGE_DRIVER.

/** Gültigkeit signierter Download-URLs privater Dateien (R-136). */
export const PRIVATE_URL_TTL_SECONDS = 300

/** Schlüssel-Präfixe im Bucket. */
export const STORAGE_PREFIX = {
  media: 'media',
  documents: 'documents',
  private: 'private',
} as const satisfies Record<UploadArea, string>

/** Unterordner unter STORAGE_LOCAL_DIR. */
const LOCAL_DIR: Record<UploadArea, string> = {
  media: 'media',
  documents: 'documents',
  private: 'private',
}

/** Präfix je Beleg-PDF (ARCHITEKTUR §3.3, C-06): `private/invoices/<Jahr>`. */
export function invoicePrefix(year: number): string {
  return `${STORAGE_PREFIX.private}/invoices/${year}`
}

/** Präfix der Monatsexporte (P5.26, L-07): `private/exports/<Jahr>`. */
export function exportPrefix(year: number): string {
  return `${STORAGE_PREFIX.private}/exports/${year}`
}

/** Absoluter Wurzelordner des Treibers `local` (außerhalb von `public/`). */
export function localStorageRoot(env: Pick<Env, 'STORAGE_LOCAL_DIR'> = getEnv()): string {
  return path.resolve(process.cwd(), env.STORAGE_LOCAL_DIR)
}

/** `upload.staticDir` eines Bereichs, z. B. `.data/media`. */
export function uploadStaticDir(
  area: UploadArea,
  env: Pick<Env, 'STORAGE_LOCAL_DIR'> = getEnv(),
): string {
  return path.join(localStorageRoot(env), LOCAL_DIR[area])
}

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
}

type UploadConfig = Exclude<NonNullable<CollectionConfig['upload']>, boolean>
type UploadHandler = NonNullable<UploadConfig['handlers']>[number]

type Doc = Record<string, unknown>

/** Bei uneingeschränktem Lesezugriff (Verwaltung) lädt Payload das Dokument nicht – dann selbst nachschlagen. */
async function resolveDoc(
  req: Parameters<UploadHandler>[0],
  collection: string,
  filename: string,
  doc: unknown,
): Promise<Doc | null> {
  if (doc && typeof doc === 'object') return doc as Doc
  const cfg = req.payload.collections[collection as 'media']?.config
  if (!cfg) return null
  const upload = typeof cfg.upload === 'object' ? cfg.upload : undefined
  const or = [
    { filename: { equals: filename } },
    ...(upload?.imageSizes ?? []).map((s) => ({
      [`sizes.${s.name}.filename`]: { equals: filename },
    })),
  ]
  const found = await req.payload.db.findOne({ collection: cfg.slug, req, where: { or } })
  return (found as Doc | null) ?? null
}

function mimeFor(doc: Doc, filename: string): string | undefined {
  if (doc.filename === filename && typeof doc.mimeType === 'string') return doc.mimeType
  const sizes = (doc.sizes ?? {}) as Record<string, { filename?: string; mimeType?: string } | null>
  for (const s of Object.values(sizes)) {
    if (s?.filename === filename && s.mimeType) return s.mimeType
  }
  return MIME_BY_EXT[path.extname(filename).toLowerCase()]
}

/** 404 ohne Inhalt und ohne Cache – unterscheidet nicht zwischen „gibt es nicht“ und „nicht sichtbar“. */
function mediaNotFound(): Response {
  return new Response('Not Found', {
    status: 404,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

/**
 * Datei-Handler (läuft nach Payloads Zugriffsprüfung, vor dem Speicher-Handler): setzt die Cache-Header passend zum
 * Dokument. Bei `s3` übernimmt der Handler von `@payloadcms/storage-s3` diese Header; bei `local` liefert dieser
 * Handler die Datei selbst aus, weil Payloads Rückfall die Header ohne Kenntnis des Dokuments setzt.
 */
export function fileResponseHandler(area: UploadArea, env: Env = getEnv()): UploadHandler {
  const handler = async (
    req: Parameters<UploadHandler>[0],
    { doc, headers, params }: Parameters<UploadHandler>[1],
  ): Promise<Response | undefined> => {
    const resolved = await resolveDoc(req, params.collection, params.filename, doc)
    let cls = cacheClassFor(area, resolved)
    if (area === 'media') {
      // Einwilligungsregel auch für die Datei selbst (KONZEPT §9.7, P7.5): nicht sichtbare Bilder → 404 für alle außer
      // der angemeldeten Verwaltung, auch bei erratener URL. Für die Verwaltung bleibt es privat (nie in einen geteilten
      // Cache); öffentlich sichtbare Seed-/Kund:innen-Bilder kurz (≤ 5 min), sonst `immutable`.
      const visible = !!resolved && isMediaPubliclyVisible(resolved, env)
      if (!visible && !isAdminRequest(req)) return mediaNotFound()
      cls = visible ? cacheClassFor(area, { ...resolved, restricted: false }) : 'private'
    }
    if (headers) applyCacheHeaders(headers, cls)
    if (env.STORAGE_DRIVER !== 'local') return undefined
    // Teilanfragen übernimmt Payloads Rückfall (Header dann konservativ über modifyResponseHeaders).
    if (req.headers.get('range')) return undefined
    const dir = uploadStaticDir(area, env)
    const filePath = path.resolve(dir, params.filename)
    if (!filePath.startsWith(dir + path.sep)) return undefined
    const mime = resolved ? mimeFor(resolved, params.filename) : undefined
    if (!mime) return undefined
    let size: number
    try {
      size = (await stat(filePath)).size
    } catch {
      return undefined
    }
    const out = applyCacheHeaders(new Headers(), cls)
    out.set('Content-Type', mime)
    out.set('Content-Length', String(size))
    out.set('X-Content-Type-Options', 'nosniff')
    const body = Readable.toWeb(createReadStream(filePath)) as ReadableStream<Uint8Array>
    return new Response(body, { status: 200, headers: out })
  }
  // Payload wertet nur `instanceof Response` aus; `undefined` heißt „nächster Handler“.
  return handler as UploadHandler
}

/**
 * Speicher-Teil der Upload-Konfiguration einer Collection:
 * `upload: { ...uploadStorage('media'), mimeTypes: [...] }`.
 */
export function uploadStorage(
  area: UploadArea,
  env: Env = getEnv(),
): Pick<UploadConfig, 'staticDir' | 'handlers' | 'modifyResponseHeaders'> {
  return {
    staticDir: uploadStaticDir(area, env),
    handlers: [fileResponseHandler(area, env)],
    modifyResponseHeaders: modifyResponseHeadersFor(area),
  }
}

type S3Collections = S3StorageOptions['collections']

/**
 * Zwei Instanzen von `@payloadcms/storage-s3` (Spike B-02): öffentlich (`media`, `documents` → S3_BUCKET) und privat
 * (`private-uploads` → S3_PRIVATE_BUCKET, signierte Downloads 300 s). Bei `local` sind die Plugins deaktiviert, fügen
 * aber dieselben Felder ein (`alwaysInsertFields`), damit das Schema in allen Umgebungen gleich ist.
 */
export function storagePlugins(env: Env = getEnv()): Plugin[] {
  const enabled = env.STORAGE_DRIVER === 's3'
  const config = enabled ? s3ClientConfig(env) : {}
  const publicCollections = {
    [UPLOAD_AREA_COLLECTION.media]: { prefix: STORAGE_PREFIX.media },
    [UPLOAD_AREA_COLLECTION.documents]: { prefix: STORAGE_PREFIX.documents },
  } as S3Collections
  const privateCollections = {
    [UPLOAD_AREA_COLLECTION.private]: {
      prefix: STORAGE_PREFIX.private,
      signedDownloads: { expiresIn: PRIVATE_URL_TTL_SECONDS },
    },
  } as S3Collections
  return [
    s3Storage({
      enabled,
      alwaysInsertFields: true,
      bucket: env.S3_BUCKET ?? '',
      clientCacheKey: 'pc-s3-public',
      collections: publicCollections,
      config,
      clientUploads: false,
    }),
    s3Storage({
      enabled,
      alwaysInsertFields: true,
      bucket: env.S3_PRIVATE_BUCKET ?? '',
      clientCacheKey: 'pc-s3-private',
      collections: privateCollections,
      config,
      clientUploads: false,
    }),
  ]
}
