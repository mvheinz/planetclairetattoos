import { pickGalleryForOg } from '@/lib/data/ogTattoo'
import { listGallery } from '@/lib/data/tattoo'
import { isLocale } from '@/lib/routes/paths'
import { createLogger } from '@/lib/monitoring/logger'
import { galleryOgAlt, OG_CONTENT_TYPE, renderGalleryOg } from '@/og/render'
import { OG_SIZE } from '@/og/templates'

// Vorschaukarte (OG-Bild) der Seite R15 Galerie (U-61, P14.12): PNG 1200 × 630 mit eigenem Motiv statt Standardbild –
// nur ein Foto mit Einwilligung (nie die Seed-Ausnahme), sonst das Standardbild. Erneuert über den Daten-Cache (Tag `tattoo-gallery`) bzw. stündlich; gilt auch für die
// Filter-Varianten darunter.

export const revalidate = 3600
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

const OG_IMAGE_ID = 'gallery'
const log = createLogger()

type Params = { locale: string }
const localeOf = (raw: string) => (isLocale(raw) ? raw : 'de')

export async function generateImageMetadata({ params }: { params: Params | Promise<Params> }) {
  const locale = localeOf((await params).locale)
  let alt = galleryOgAlt(null, locale)
  try {
    alt = galleryOgAlt(pickGalleryForOg(await listGallery(locale)), locale)
  } catch (err) {
    log.warn('og.metadata_failed', { reason: (err as Error).message })
  }
  return [{ id: OG_IMAGE_ID, alt, size: OG_SIZE, contentType: OG_CONTENT_TYPE }]
}

export default async function Image({ params }: { params: Promise<Params> }) {
  const locale = localeOf((await params).locale)
  return renderGalleryOg(pickGalleryForOg(await listGallery(locale)), locale)
}
