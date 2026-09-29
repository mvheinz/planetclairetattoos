import type { MetadataRoute } from 'next'

import { getSitemapData } from '@/lib/data/sitemap'
import { createLogger } from '@/lib/monitoring/logger'
import { buildSitemap, EMPTY_SITEMAP_DATA, type SitemapData } from '@/lib/seo/sitemap'

// `/sitemap.xml` (KONZEPT §2.5, P3.13): indexierbare `live`-Seiten, öffentliche Stücke und Kategorien beider Sprachen
// mit Alternates und `lastmod`. ISR (ARCHITEKTUR §9.1): Erneuerung über Tag `sitemap`, Rückfall nach einer Stunde.
// Ohne Datenbank (Build ohne DB) nur die festen Seiten.

export const revalidate = 3600

const log = createLogger()

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let data: SitemapData = EMPTY_SITEMAP_DATA
  try {
    data = await getSitemapData()
  } catch (err) {
    log.warn('sitemap.data_unavailable', { reason: (err as Error).message })
  }
  return buildSitemap(undefined, data)
}
