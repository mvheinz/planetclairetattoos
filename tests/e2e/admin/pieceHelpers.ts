import type { Page, Request } from '@playwright/test'
import sharp from 'sharp'

import { testPayload } from '../fixtures'

// Gemeinsame Helfer der Formular-Tests „Neues Stück“ (P5.5/P5.6).

/** Eigene, nicht reservierte Nummern je Projekt (901–999 sind bei Beispieldaten für die Verwaltung gesperrt). */
const PROJECT_NUMBER: Record<string, number> = { desktop: 8980, 'iphone-15': 8981, 'pixel-7': 8982 }
export const formNumber = (project: string, offset = 0): number =>
  (PROJECT_NUMBER[project] ?? 8983) + offset * 10

/** Stücke (per Nummer) und die hochgeladenen Bilder wieder entfernen. */
export async function removePieces(numbers: number[], mediaIds: number[] = []): Promise<void> {
  const payload = await testPayload()
  await payload.delete({
    collection: 'products',
    where: { itemNumber: { in: numbers } },
    overrideAccess: true,
    context: { seed: true },
  })
  if (mediaIds.length) {
    await payload.delete({
      collection: 'media',
      where: { id: { in: mediaIds } },
      overrideAccess: true,
    })
  }
}

/** IDs der Bilder in der Fotoliste (Reihenfolge wie angezeigt). */
export const listedMediaIds = (page: Page): Promise<number[]> =>
  page
    .getByTestId('photo-list')
    .locator('li')
    .evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-media-id'))))

/** Einfarbiges JPEG in beliebiger Größe (z. B. 6000 × 4000). */
export const jpeg = (width: number, height: number): Promise<Buffer> =>
  sharp({ create: { width, height, channels: 3, background: { r: 180, g: 120, b: 90 } } })
    .jpeg({ quality: 90 })
    .toBuffer()

/** Datei-Teil einer multipart-Anfrage (`name="file"`). */
export function multipartFile(req: Request): Buffer | null {
  const body = req.postDataBuffer()
  if (!body) return null
  const header = body.indexOf('name="file"')
  if (header < 0) return null
  const start = body.indexOf('\r\n\r\n', header) + 4
  const type = req.headers()['content-type'] ?? ''
  const boundary = /boundary=(.+)$/.exec(type)?.[1]
  const end = boundary ? body.indexOf(`\r\n--${boundary}`, start) : -1
  return body.subarray(start, end > 0 ? end : undefined)
}
