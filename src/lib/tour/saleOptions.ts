import 'server-only'

import type { PayloadRequest } from 'payload'

import { addBerlinDays } from '@/lib/time'
import { tourDateText } from '@/lib/tour/dates'
import type { TourDate } from '@/payload-types'

// Auswahl „Auf welchem Termin?“ im Dialog „Offline verkauft“ (U-60, P14.11): Termine der letzten 90 Tage und der
// nächsten beiden Tage (neueste zuerst, auch offline/abgesagt – verkauft wird trotzdem), Beschriftung „Name · Datum“.

export interface TourSaleOption {
  id: number
  label: string
}

export const TOUR_SALE_LOOKBACK_DAYS = 90

export async function loadTourSaleOptions(
  req: PayloadRequest,
  now: Date,
): Promise<TourSaleOption[]> {
  const result = await req.payload.find({
    collection: 'tour-dates',
    where: {
      and: [
        { startsAt: { less_than_equal: addBerlinDays(now, 2).toISOString() } },
        {
          endsAt: {
            greater_than_equal: addBerlinDays(now, -TOUR_SALE_LOOKBACK_DAYS).toISOString(),
          },
        },
      ],
    },
    sort: '-startsAt',
    limit: 30,
    depth: 0,
    locale: 'de',
    overrideAccess: true,
    req,
  })
  return (result.docs as TourDate[]).map((d) => ({
    id: d.id,
    label: `${d.name} · ${tourDateText({ startsAt: d.startsAt, endsAt: d.endsAt ?? d.startsAt }, 'de')}`,
  }))
}
