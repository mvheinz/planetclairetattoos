import type { Page } from '@playwright/test'
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
