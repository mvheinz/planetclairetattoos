import type { MetadataRoute } from 'next'

import { localizedPath, pageRoutes } from '@/lib/routes/paths'
import { DEFAULT_LOCALE, LOCALES } from '@/lib/routes/registry'

import { absoluteUrl } from './metadata'

// Sitemap (KONZEPT §2.5, P2.11): alle `live`-Seiten mit `robots = index` und ohne Parameter in beiden Sprachen, je
// Eintrag mit `xhtml:link`-Alternates `de`, `en`, `x-default`. Stücke, Kategorien und `lastmod` kommen ab P3 dazu
// (Tag `sitemap`, ARCHITEKTUR §9.3).
export function buildSitemap(siteUrl?: string): MetadataRoute.Sitemap {
  return pageRoutes()
    .filter((r) => r.status === 'live' && r.robots === 'index' && !r.paths!.de.includes('['))
    .flatMap((r) => {
      const languages = {
        ...Object.fromEntries(
          LOCALES.map((l) => [l, absoluteUrl(localizedPath(r.id, l), siteUrl)]),
        ),
        'x-default': absoluteUrl(localizedPath(r.id, DEFAULT_LOCALE), siteUrl),
      }
      return LOCALES.map((l) => ({
        url: absoluteUrl(localizedPath(r.id, l), siteUrl),
        alternates: { languages },
      }))
    })
}
