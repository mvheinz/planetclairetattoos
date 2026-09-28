import type { MetadataRoute } from 'next'

import { buildSitemap } from '@/lib/seo/sitemap'

// `/sitemap.xml` (KONZEPT §2.5): indexierbare `live`-Seiten beider Sprachen mit Alternates.
export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemap()
}
