// Verkleinern und Hochladen der Bilder des Auftragsarbeiten-Formulars (Regeln: `./imageRules`). Wird vom Formular erst
// bei der ersten Bildauswahl per `import()` geladen, nicht beim ersten Seitenaufruf.

import { IMAGE_MAX_EDGE, IMAGE_MAX_UPLOAD_BYTES, IMAGE_QUALITIES, fitWithin } from './imageRules'

const toBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))

/** Verkleinert und kodiert als JPEG (Orientierung aus EXIF angewendet; Metadaten fallen weg). */
export async function resizeForUpload(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    let edge = Math.min(IMAGE_MAX_EDGE, Math.max(bitmap.width, bitmap.height))
    for (let round = 0; round < 4; round++) {
      const size = fitWithin(bitmap.width, bitmap.height, edge)
      const canvas = document.createElement('canvas')
      canvas.width = size.width
      canvas.height = size.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('canvas')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, size.width, size.height)
      ctx.drawImage(bitmap, 0, 0, size.width, size.height)
      for (const q of IMAGE_QUALITIES) {
        const blob = await toBlob(canvas, q)
        if (blob && blob.size <= IMAGE_MAX_UPLOAD_BYTES) return blob
      }
      edge = Math.round(edge * 0.75)
    }
    throw new Error('too_large')
  } finally {
    bitmap.close()
  }
}

export interface UploadedImage {
  uploadId: number
  ticket: string
}

/** Lädt ein Bild hoch (XHR wegen Upload-Fortschritt); wirft bei jedem Fehlerstatus. */
export function uploadImage(
  blob: Blob,
  token: string,
  locale: 'de' | 'en',
  onProgress: (percent: number) => void,
): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `/api/uploads/commission?locale=${locale}`)
    xhr.setRequestHeader('x-form-token', token)
    xhr.responseType = 'json'
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)))
    }
    xhr.onload = () => {
      const body = xhr.response as Partial<UploadedImage> | null
      if (xhr.status === 201 && body && typeof body.uploadId === 'number' && body.ticket) {
        resolve({ uploadId: body.uploadId, ticket: body.ticket })
      } else reject(new Error(`upload_${xhr.status}`))
    }
    xhr.onerror = () => reject(new Error('upload_network'))
    const form = new FormData()
    form.append('file', blob, 'bild.jpg')
    xhr.send(form)
  })
}
