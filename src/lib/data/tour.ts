import 'server-only'

import { cached } from '@/lib/cache/cached'
import { TAGS } from '@/lib/cache/tags'
import type { Locale, TourStatus } from '@/lib/enums'
import { createLogger } from '@/lib/monitoring/logger'
import { getPublicPayload } from '@/lib/payload/public'
import { parseTourLink } from '@/lib/tour/address'
import { isMediaPubliclyVisible } from '@/lib/tattoo/visibility'
import { addBerlinDays, systemClock } from '@/lib/time'
import type { Media, TourDate } from '@/payload-types'

// „Planet Claire on Tour“ (P12.8, U-20): gecachte Lesefunktion der Termine (Tag `tour-dates`, Rückfall nach einer Stunde).
// Gelesen wird über `getPublicPayload()` (Zugriffsregel: nur veröffentlichte, Seed-Filter greift); die Aufteilung in kommende
// und vergangene Termine geschieht beim Rendern (`splitTourDates`), damit „vorbei“ dem Datum folgt. Termine, die länger
// als ein Jahr her sind, lädt der Loader nicht mehr. Ohne Datenbank: leere Liste (kein Fehler auf der Startseite).

const log = createLogger()

/** Bild des Stands (nur öffentlich sichtbare Bilder). */
export type TourImage = Pick<
  Media,
  'id' | 'alt' | 'url' | 'width' | 'height' | 'focalX' | 'focalY' | 'dominantColor' | 'sizes'
>

export interface PublicTourDate {
  id: number
  name: string
  place: string
  address: string | null
  /** Web-Adresse des Marktes (nur Textlink, kein Embed). */
  link: string | null
  standNumber: string | null
  timeFrom: string | null
  timeTo: string | null
  note: string | null
  startsAt: string
  endsAt: string
  status: TourStatus
  image: TourImage | null
}

const text = (v: string | null | undefined): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null

function publicImage(value: number | Media | null | undefined): TourImage | null {
  if (!value || typeof value !== 'object') return null
  if (!isMediaPubliclyVisible(value)) return null
  const { id, alt, url, width, height, focalX, focalY, dominantColor, sizes } = value
  return { id, alt, url, width, height, focalX, focalY, dominantColor, sizes }
}

export function toPublicTourDate(doc: TourDate): PublicTourDate {
  return {
    id: doc.id,
    name: doc.name,
    place: doc.place,
    address: text(doc.address),
    link: parseTourLink(doc.link),
    standNumber: text(doc.standNumber),
    timeFrom: text(doc.timeFrom),
    timeTo: text(doc.timeTo),
    note: text(doc.note),
    startsAt: doc.startsAt,
    endsAt: doc.endsAt ?? doc.startsAt,
    status: doc.status,
    image: publicImage(doc.image),
  }
}

export async function loadTourDates(locale: Locale): Promise<PublicTourDate[]> {
  try {
    const payload = await getPublicPayload()
    const since = addBerlinDays(systemClock.now(), -366)
    const res = await payload.find({
      collection: 'tour-dates',
      where: {
        and: [
          { published: { equals: true } },
          { endsAt: { greater_than_equal: since.toISOString() } },
        ],
      },
      locale,
      fallbackLocale: 'de',
      depth: 1,
      limit: 200,
      pagination: false,
      sort: 'startsAt',
    })
    return res.docs.filter((d) => d.published !== false).map(toPublicTourDate)
  } catch (err) {
    log.warn('tour.load_failed', { reason: (err as Error).message })
    return []
  }
}

/** Veröffentlichte Termine (kommende und gut ein Jahr zurück), nach Beginn sortiert. */
export const listTourDates = cached(loadTourDates, { key: 'tour-dates', tags: [TAGS.tourDates] })
