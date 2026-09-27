import 'server-only'

import { createHash } from 'node:crypto'

import sharp from 'sharp'

// Bildpipeline (DATENMODELL §6.2, DESIGN §12.2 Schritte 1–3, 7, 8). Reine Funktionen auf Buffern.

export const MEDIA_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
const SHARP_FORMATS: Record<string, (typeof MEDIA_MIME_TYPES)[number]> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

/** Obergrenze je Datei (DATENMODELL §6.2). */
export const MEDIA_MAX_BYTES = 20 * 1024 * 1024
/** Lange Kante des Originals (und Ziel der Browser-Verkleinerung). */
export const MEDIA_MAX_EDGE = 2560

export class MediaFileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MediaFileError'
  }
}

export const MEDIA_TYPE_MESSAGE = 'Erlaubt sind nur Bilder als JPEG, PNG oder WebP.'

/** Prüft den tatsächlichen Dateiinhalt (nicht nur den angegebenen Typ). */
export async function detectMediaType(
  buffer: Buffer,
  declaredMime?: string,
): Promise<(typeof MEDIA_MIME_TYPES)[number]> {
  if (declaredMime && !(MEDIA_MIME_TYPES as readonly string[]).includes(declaredMime)) {
    throw new MediaFileError(MEDIA_TYPE_MESSAGE)
  }
  let format: string | undefined
  try {
    format = (await sharp(buffer).metadata()).format
  } catch {
    throw new MediaFileError(MEDIA_TYPE_MESSAGE)
  }
  const mime = format ? SHARP_FORMATS[format] : undefined
  if (!mime) throw new MediaFileError(MEDIA_TYPE_MESSAGE)
  return mime
}

export interface NormalizedUpload {
  data: Buffer
  mimetype: 'image/png'
  name: string
  size: number
}

/** Dateiname mit Inhalts-Hash (Auslieferung `immutable`, DATENMODELL §6.2). */
export function hashedName(originalName: string, buffer: Buffer, ext: string): string {
  const base =
    originalName
      .replace(/\.[^.]*$/, '')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'bild'
  const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 10)
  return `${base}-${hash}.${ext}`
}

/**
 * Schritt 2 „Normieren“: EXIF-Orientierung anwenden, in sRGB wandeln, alle Metadaten verwerfen (EXIF, GPS, XMP, IPTC,
 * ICC). Ausgabe verlustfrei (PNG), damit Payloads `formatOptions` (WebP q 90) die einzige verlustbehaftete Kodierung ist.
 */
export async function normalizeUpload(
  buffer: Buffer,
  name: string,
  declaredMime?: string,
): Promise<NormalizedUpload> {
  if (buffer.length > MEDIA_MAX_BYTES) {
    throw new MediaFileError('Die Datei ist größer als 20 MB.')
  }
  await detectMediaType(buffer, declaredMime)
  const data = await sharp(buffer, { failOn: 'error' })
    .rotate()
    .toColourspace('srgb')
    .png({ compressionLevel: 1 })
    .toBuffer()
  return { data, mimetype: 'image/png', name: hashedName(name, buffer, 'png'), size: data.length }
}

/** Schritt 8: LQIP (WebP, 16 px lange Kante, Base64, ≤ 2 KB) und Dominanzfarbe `#rrggbb`. */
export async function computePlaceholder(
  buffer: Buffer,
): Promise<{ placeholderDataUrl: string; dominantColor: string }> {
  const img = sharp(buffer).rotate()
  const small = await img.clone().resize(16, 16, { fit: 'inside' }).webp({ quality: 40 }).toBuffer()
  const placeholderDataUrl = `data:image/webp;base64,${small.toString('base64')}`
  const { dominant } = await img.clone().stats()
  const hex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0')
  return {
    placeholderDataUrl,
    dominantColor: `#${hex(dominant.r)}${hex(dominant.g)}${hex(dominant.b)}`,
  }
}

export interface SizeSpec {
  name: string
  width?: number
  height?: number
}

export interface SizeData {
  filename?: string | null
  width?: number | null
  height?: number | null
  mimeType?: string | null
  filesize?: number | null
  url?: string | null
}

/**
 * Schritt 3/7: Eine Größe gilt nur, wenn sie exakt das Zielmaß hat (4:5-Zuschnitt bzw. Zielbreite). Kleinere Ausgaben
 * entstehen, wenn das Original zu klein ist (`withoutEnlargement`) – sie entfallen (DESIGN §12.2 Schritt 7).
 */
export function isCompleteSize(spec: SizeSpec, size: SizeData | null | undefined): boolean {
  if (!size?.filename) return false
  if (spec.width && size.width !== spec.width) return false
  if (spec.height && size.height !== spec.height) return false
  return true
}
