import 'server-only'

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

import sharp from 'sharp'

import { MEDIA_MAX_EDGE, MediaFileError, detectMediaType, hashedName } from '@/lib/media/pipeline'

// Dateiprüfung für `documents` (DATENMODELL §6.3) und `private-uploads` (§6.4). Typ wird am Inhalt erkannt, nicht an
// Endung oder angegebenem MIME-Typ.

export const PDF_MIME = 'application/pdf'
export const PRIVATE_UPLOAD_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  PDF_MIME,
] as const
/** Höchstgröße je Datei aus der Verwaltung (§6.4). */
export const PRIVATE_UPLOAD_MAX_BYTES = 10 * 1024 * 1024
/** Höchstgröße öffentlicher PDFs (§6.3). */
export const DOCUMENT_MAX_BYTES = 20 * 1024 * 1024
/** JPEG-Qualität privater Bilder (§6.4). */
export const PRIVATE_IMAGE_QUALITY = 85

export class UploadFileError extends MediaFileError {
  constructor(message: string) {
    super(message)
    this.name = 'UploadFileError'
  }
}

export const PDF_ONLY_MESSAGE = 'Erlaubt sind nur PDF-Dateien.'
export const PRIVATE_TYPE_MESSAGE = 'Erlaubt sind nur Bilder (JPEG, PNG, WebP) und PDF-Dateien.'

export function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

/** PDF am Inhalt erkennen: Kennung `%PDF-` am Anfang (Payload prüft zusätzlich `xref` und `%%EOF` am Ende). */
export function isPdf(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString('latin1') === '%PDF-'
}

export async function fileBuffer(file: { data?: Buffer; tempFilePath?: string }): Promise<Buffer> {
  if (file.data && file.data.length > 0) return file.data
  if (file.tempFilePath) return readFile(file.tempFilePath)
  return Buffer.alloc(0)
}

const mb = (bytes: number) => Math.round(bytes / 1024 / 1024)

export interface CheckedFile {
  data: Buffer
  mimetype: string
  name: string
  size: number
}

/** Öffentliches PDF (`documents`): nur PDF, höchstens 20 MB. */
export function checkDocumentFile(buffer: Buffer, name: string): CheckedFile {
  if (buffer.length > DOCUMENT_MAX_BYTES) {
    throw new UploadFileError(`Die Datei ist größer als ${mb(DOCUMENT_MAX_BYTES)} MB.`)
  }
  if (!isPdf(buffer)) throw new UploadFileError(PDF_ONLY_MESSAGE)
  return { data: buffer, mimetype: PDF_MIME, name, size: buffer.length }
}

/**
 * Private Datei: höchstens 10 MB; PDFs unverändert; Bilder werden gedreht (EXIF-Orientierung), auf höchstens 2560 px
 * verkleinert und als JPEG q 85 neu kodiert – dabei entfallen alle Metadaten (EXIF, GPS, XMP, IPTC; R-135).
 */
export async function normalizePrivateFile(
  buffer: Buffer,
  name: string,
  declaredMime?: string,
): Promise<CheckedFile> {
  if (buffer.length > PRIVATE_UPLOAD_MAX_BYTES) {
    throw new UploadFileError(`Die Datei ist größer als ${mb(PRIVATE_UPLOAD_MAX_BYTES)} MB.`)
  }
  if (isPdf(buffer)) {
    if (declaredMime && declaredMime !== PDF_MIME && !declaredMime.startsWith('application/')) {
      throw new UploadFileError(PRIVATE_TYPE_MESSAGE)
    }
    return { data: buffer, mimetype: PDF_MIME, name, size: buffer.length }
  }
  try {
    await detectMediaType(buffer, declaredMime === PDF_MIME ? undefined : declaredMime)
  } catch {
    throw new UploadFileError(PRIVATE_TYPE_MESSAGE)
  }
  const data = await sharp(buffer, { failOn: 'error' })
    .rotate()
    .resize(MEDIA_MAX_EDGE, MEDIA_MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .toColourspace('srgb')
    .jpeg({ quality: PRIVATE_IMAGE_QUALITY, mozjpeg: true })
    .toBuffer()
  return { data, mimetype: 'image/jpeg', name: hashedName(name, buffer, 'jpg'), size: data.length }
}
