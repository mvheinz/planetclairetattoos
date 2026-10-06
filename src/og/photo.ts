import 'server-only'

import sharp, { type Sharp } from 'sharp'

import { readMediaFile } from '@/lib/storage/read'

// Erstes Produktfoto für das OG-Produktbild (P3.14, DESIGN §12.6): 504 × 630 (4:5) am Fokuspunkt, als JPEG-Data-URL.
// Gelesen wird eine lokal gespeicherte Bildgröße – bevorzugt `card` (schon 4:5 am Fokuspunkt zugeschnitten, DESIGN
// §12.2), sonst das Original mit eigenem Zuschnitt am Fokuspunkt, zuletzt `thumb`. Kein Netzwerkabruf über die
// öffentliche URL.

export const OG_PHOTO = { width: 504, height: 630 } as const

interface StoredSize {
  filename?: string | null
  width?: number | null
  height?: number | null
}

export interface OgMediaInput extends StoredSize {
  focalX?: number | null
  focalY?: number | null
  prefix?: string | null
  sizes?: { card?: StoredSize | null; thumb?: StoredSize | null } | null
}

export interface CropRect {
  left: number
  top: number
  width: number
  height: number
}

/**
 * Größtmögliches Rechteck im Seitenverhältnis `ratio` (Breite/Höhe), zentriert auf den Fokuspunkt (Prozent), an den
 * Rändern begrenzt – wie der Zuschnitt der Bild-Pipeline (DESIGN §12.2 Schritt 3).
 */
export function focalCrop(
  width: number,
  height: number,
  focalX = 50,
  focalY = 50,
  ratio = OG_PHOTO.width / OG_PHOTO.height,
): CropRect {
  const w = Math.min(width, Math.round(height * ratio))
  const h = Math.min(height, Math.round(w / ratio))
  const clamp = (v: number, max: number) => Math.min(Math.max(0, v), max)
  const left = clamp(Math.round((width * focalX) / 100 - w / 2), width - w)
  const top = clamp(Math.round((height * focalY) / 100 - h / 2), height - h)
  return { left, top, width: w, height: h }
}

const is45 = (s: StoredSize | null | undefined): s is StoredSize & { filename: string } =>
  !!s?.filename &&
  !!s.width &&
  !!s.height &&
  Math.abs(s.width / s.height - OG_PHOTO.width / OG_PHOTO.height) < 0.01

/** JPEG 504 × 630 als Data-URL oder `null` (kein Foto, Datei fehlt, nicht lesbar). */
export async function productPhotoDataUrl(
  media: OgMediaInput | number | null | undefined,
): Promise<string | null> {
  if (!media || typeof media !== 'object') return null
  try {
    let image: Sharp | null = null
    // Reihenfolge nach Auflösung: `card` (800 × 1000), Original mit Zuschnitt, `thumb` (400 × 500).
    const card = media.sizes?.card
    if (is45(card)) {
      const buf = await readMediaFile(card.filename, media.prefix)
      if (buf) image = sharp(buf)
    }
    if (!image && media.filename) {
      const buf = await readMediaFile(media.filename, media.prefix)
      if (buf) {
        // Originale sind beim Hochladen schon gedreht und ohne Metadaten normiert (DESIGN §12.2 Schritt 2).
        const meta = await sharp(buf).metadata()
        if (meta.width && meta.height)
          image = sharp(buf).extract(
            focalCrop(meta.width, meta.height, media.focalX ?? 50, media.focalY ?? 50),
          )
      }
    }
    const thumb = media.sizes?.thumb
    if (!image && is45(thumb)) {
      const buf = await readMediaFile(thumb.filename, media.prefix)
      if (buf) image = sharp(buf)
    }
    if (!image) return null
    const jpeg = await image
      .resize(OG_PHOTO.width, OG_PHOTO.height, { fit: 'cover' })
      .flatten({ background: '#E6EACD' })
      .jpeg({ quality: 84, mozjpeg: true })
      .toBuffer()
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`
  } catch {
    return null
  }
}
