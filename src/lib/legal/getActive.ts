import 'server-only'

import config from '@payload-config'
import { getPayload, type Payload, type PayloadRequest } from 'payload'

import type { LegalTextType, Locale } from '@/lib/enums'
import { preservingReq } from '@/lib/payload/localReq'
import type { LegalText } from '@/payload-types'

// Gültige Rechtstext-Fassung zu einem Zeitpunkt (DATENMODELL §6.12, R-012): die veröffentlichte bzw. abgelöste Fassung
// mit dem spätesten `validFrom ≤ at` (bei gleichem Datum die höhere Version). Entwürfe und geplante Fassungen zählen
// nicht. Zu „jetzt“ ist das genau die aktive Fassung des Typs.

export interface GetActiveLegalTextOptions {
  payload?: Payload
  /** Gleiche Transaktion wie ein laufender Vorgang (z. B. Kasse absenden). */
  req?: PayloadRequest
  locale?: Locale
}

export async function getActiveLegalText(
  type: LegalTextType,
  at: Date,
  options: GetActiveLegalTextOptions = {},
): Promise<LegalText | null> {
  const payload = options.payload ?? options.req?.payload ?? (await getPayload({ config }))
  const find = () =>
    payload.find({
      collection: 'legal-texts',
      where: {
        and: [
          { type: { equals: type } },
          { status: { in: ['active', 'superseded'] } },
          { validFrom: { less_than_equal: at.toISOString() } },
        ],
      },
      sort: ['-validFrom', '-version'],
      limit: 1,
      depth: 0,
      locale: options.locale,
      overrideAccess: true,
      req: options.req,
    })
  const res = options.req ? await preservingReq(options.req, find) : await find()
  return res.docs[0] ?? null
}
