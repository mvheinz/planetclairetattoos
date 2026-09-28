import 'server-only'

import { unstable_cache } from 'next/cache'

import { TAGS } from '@/lib/cache/tags'
import type { Locale, PageKey } from '@/lib/enums'
import { createLogger } from '@/lib/monitoring/logger'
import { getPublicPayload } from '@/lib/payload/public'
import type { Page } from '@/payload-types'

// Seiten aus Blöcken (DATENMODELL §6.19): die veröffentlichte Seite zu `key`, öffentlich gelesen (Seed-Filter greift).
// Fehlt sie oder ist die Datenbank nicht erreichbar, liefert der Loader `null` – die Route zeigt dann einen neutralen
// Leerzustand statt 500 (DM-PAGE-01). Zwischengespeichert (Tag `page:<key>`, spätestens nach 60 s neu).

const log = createLogger()

/** Lädt die veröffentlichte Seite (ungecacht). */
export async function loadPublicPage(key: PageKey, locale: Locale): Promise<Page | null> {
  try {
    const payload = await getPublicPayload()
    const res = await payload.find({
      collection: 'pages',
      where: { key: { equals: key } },
      locale,
      fallbackLocale: 'de',
      depth: 1,
      limit: 1,
      pagination: false,
    })
    return res.docs[0] ?? null
  } catch (err) {
    log.warn('pages.load_failed', { key, locale, reason: (err as Error).message })
    return null
  }
}

/** Veröffentlichte Seite je `key` und Sprache (gecacht). */
export const getPublicPage = (key: PageKey, locale: Locale): Promise<Page | null> =>
  unstable_cache(() => loadPublicPage(key, locale), ['public-page', key, locale], {
    tags: [TAGS.page(key)],
    revalidate: 60,
  })()
