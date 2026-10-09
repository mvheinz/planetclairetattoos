import 'server-only'

import { APIError, type PayloadRequest } from 'payload'

import type { Locale } from '@/lib/enums'
import { preservingReq } from '@/lib/payload/localReq'
import { inTransaction } from '@/lib/payload/transaction'
import { tourInputFromRange, tourRangeFromInput } from '@/lib/tour/dates'
import type { TourDate } from '@/payload-types'

// „Termin kopieren“ (U-60, P14.11): neuer Termin mit Name, Ort, Notiz (DE/EN), Adresse, Link und Uhrzeiten eines
// vorhandenen Termins – eine Woche später (gleiche Wochentage, ganze Berliner Tage), Status „geplant“ und **offline**
// (Entwurf), bis Jutta das Datum geprüft und „Online“ angehakt hat. Nicht übernommen: Standnummer und Foto vom Stand
// (gehören zum einzelnen Markttag).

export const TOUR_COPY_SHIFT_DAYS = 7

/** `YYYY-MM-DD` um `days` Kalendertage verschieben (reines Datum, ohne Uhrzeit/Zeitzone). */
export function shiftDateKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number]
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return t.toISOString().slice(0, 10)
}

const text = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null

export async function copyTourDate(
  req: PayloadRequest,
  sourceId: number,
): Promise<{ doc: { id: number; startsAt: string; published: boolean }; unchanged: false }> {
  const read = (locale: Locale) =>
    preservingReq(req, () =>
      req.payload.findByID({
        collection: 'tour-dates',
        id: sourceId,
        locale,
        fallbackLocale: false,
        depth: 0,
        overrideAccess: true,
        disableErrors: true,
        req,
      }),
    ) as Promise<TourDate | null>
  const de = await read('de')
  if (!de) throw new APIError('Den Termin gibt es nicht (mehr).', 404)
  const en = await read('en')

  const input = tourInputFromRange({ startsAt: de.startsAt, endsAt: de.endsAt ?? de.startsAt })
  const range = tourRangeFromInput({
    startDate: shiftDateKey(input.startDate, TOUR_COPY_SHIFT_DAYS),
    endDate: shiftDateKey(input.endDate, TOUR_COPY_SHIFT_DAYS),
  })
  if ('issues' in range) throw new APIError('Das Datum ließ sich nicht übernehmen.', 400)

  return inTransaction(req, async () => {
    const created = (await preservingReq(req, () =>
      req.payload.create({
        collection: 'tour-dates',
        locale: 'de',
        data: {
          name: de.name,
          place: de.place,
          note: text(de.note),
          address: text(de.address),
          link: text(de.link),
          timeFrom: text(de.timeFrom),
          timeTo: text(de.timeTo),
          startsAt: range.startsAt.toISOString(),
          endsAt: range.endsAt.toISOString(),
          status: 'planned',
          published: false,
        } as never,
        depth: 0,
        overrideAccess: false,
        req,
      }),
    )) as TourDate
    const enData = { name: text(en?.name), place: text(en?.place), note: text(en?.note) }
    if (Object.values(enData).some(Boolean)) {
      await preservingReq(req, () =>
        req.payload.update({
          collection: 'tour-dates',
          id: created.id,
          locale: 'en',
          data: {
            name: enData.name ?? de.name,
            place: enData.place ?? de.place,
            note: enData.note,
          } as never,
          depth: 0,
          overrideAccess: false,
          req,
        }),
      )
    }
    return {
      doc: { id: created.id, startsAt: created.startsAt, published: created.published !== false },
      unchanged: false as const,
    }
  })
}
