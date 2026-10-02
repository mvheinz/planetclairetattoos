import {
  DOWNSCALE_JPEG_QUALITY,
  DOWNSCALE_MAX_EDGE,
  downscaleDimensions,
  downscaledName,
} from '@/lib/media/downscale'

// Verkleinerung im Browser vor dem Upload (PLAN P5.5, ARCHITEKTUR §8.8): `createImageBitmap(file, { imageOrientation:
// 'from-image' })` + Canvas auf höchstens 2560 px lange Kante, JPEG Qualität 0,85. Ein Bild je Upload-Anfrage, höchstens
// 4,5 MB (Grenze der Hosting-Funktion); größere Dateien werden mit verständlichem Hinweis abgelehnt. Die reinen
// Rechenregeln sind ohne Browser testbar (`tests/unit/admin/resize.unit.spec.ts`).

/** Größte Upload-Anfrage (Vercel-Funktionsgrenze 4,5 MB). */
export const PHOTO_UPLOAD_MAX_BYTES = 4.5 * 1024 * 1024
/** Dateiauswahl: nur JPEG/PNG/WebP – iOS wandelt HEIC dann selbst in JPEG um. */
export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp'
export const PHOTO_TYPES: readonly string[] = PHOTO_ACCEPT.split(',')

export interface ResizePlan {
  width: number
  height: number
  /** Neu als JPEG kodieren (immer bei Verkleinerung oder zu großer Datei). */
  reencode: boolean
}

/** Zielmaße: lange Kante ≤ 2560 px, nie vergrößern; neu kodieren, wenn verkleinert oder die Datei zu groß ist. */
export function planResize(width: number, height: number, bytes: number): ResizePlan {
  const target = downscaleDimensions(width, height, DOWNSCALE_MAX_EDGE)
  return {
    width: target.width,
    height: target.height,
    reencode: target.scaled || bytes > PHOTO_UPLOAD_MAX_BYTES,
  }
}

export function isAcceptedPhotoType(type: string): boolean {
  return PHOTO_TYPES.includes(type)
}

export function isUploadTooLarge(bytes: number): boolean {
  return bytes > PHOTO_UPLOAD_MAX_BYTES
}

export interface PreparedPhoto {
  file: File
  width: number
  height: number
}

/** Im Browser: Foto richtig drehen und bei Bedarf verkleinern (JPEG 0,85). */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const plan = planResize(bitmap.width, bitmap.height, file.size)
    if (!plan.reencode) return { file, width: bitmap.width, height: bitmap.height }
    const canvas = document.createElement('canvas')
    canvas.width = plan.width
    canvas.height = plan.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, plan.width, plan.height)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', DOWNSCALE_JPEG_QUALITY),
    )
    if (!blob) throw new Error('toBlob')
    return {
      file: new File([blob], downscaledName(file.name), {
        type: 'image/jpeg',
        lastModified: file.lastModified,
      }),
      width: plan.width,
      height: plan.height,
    }
  } finally {
    bitmap.close()
  }
}
