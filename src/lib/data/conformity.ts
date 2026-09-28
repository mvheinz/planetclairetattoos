import 'server-only'

import { unstable_cache } from 'next/cache'

import { TAGS } from '@/lib/cache/tags'
import type { Locale } from '@/lib/enums'
import { createLogger } from '@/lib/monitoring/logger'
import { getPublicPayload } from '@/lib/payload/public'

// Aktive Konformitätserklärungen für R27 (KONZEPT §3.14): Glasurname, „gültig ab“ und – falls öffentlich lesbar – das
// PDF. Die Zuordnung der Stücke („Nr. 017“) folgt mit den Produktseiten (P6). Ist die Datenbank nicht erreichbar, ist
// die Liste leer; die Seite bleibt erreichbar.

const log = createLogger()

export interface ConformityItem {
  id: number
  name: string
  validFrom: string
  pdfUrl: string | null
}

export async function loadActiveConformity(locale: Locale): Promise<ConformityItem[]> {
  try {
    const payload = await getPublicPayload()
    const res = await payload.find({
      collection: 'conformity-declarations',
      where: { status: { equals: 'active' } },
      sort: 'name',
      locale,
      fallbackLocale: 'de',
      depth: 1,
      limit: 100,
      pagination: false,
    })
    return res.docs
      .filter((d) => typeof d.name === 'string' && d.name)
      .map((d) => {
        const pdf = d.declarationPdf
        const url = typeof pdf === 'object' && pdf && typeof pdf.url === 'string' ? pdf.url : null
        return { id: d.id, name: d.name, validFrom: d.validFrom, pdfUrl: url }
      })
  } catch (err) {
    log.warn('conformity.load_failed', { locale, reason: (err as Error).message })
    return []
  }
}

/** Aktive Erklärungen je Sprache (gecacht, Tag `page:conformity` wie der Fußlink). */
export const getActiveConformity = (locale: Locale): Promise<ConformityItem[]> =>
  unstable_cache(() => loadActiveConformity(locale), ['active-conformity', locale], {
    tags: [TAGS.page('conformity')],
    revalidate: 60,
  })()
