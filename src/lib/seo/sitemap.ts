import type { MetadataRoute } from 'next'

import { pickLocale, type LocalizedValue } from '@/lib/products/localized'
import { localizedPath, pageRoutes, type RouteParams } from '@/lib/routes/paths'
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@/lib/routes/registry'
import { productParams } from '@/lib/shop/format'

import { absoluteUrl } from './metadata'

// Sitemap (KONZEPT §2.5, P2.11, P3.13): alle `live`-Seiten mit `robots = index` und ohne Parameter in beiden Sprachen,
// dazu die öffentlichen Stücke (`available`, `reserved`, `sold` mit Archiv) und alle Kategorien – je Eintrag mit
// `xhtml:link`-Alternates `de`, `en`, `x-default` (→ DE) und bei Stücken/Kategorien `lastmod` aus `updatedAt`. Korb,
// Kasse und Token-Seiten stehen nie darin (`noindex`). Die Daten liefert `src/lib/data/sitemap.ts` (Tag `sitemap`).

export interface SitemapProduct {
  itemNumber: number
  /** Slugs je Sprache (`locale: 'all'`); fehlt EN, gilt der DE-Slug. */
  slug: LocalizedValue
  updatedAt: string
}

export interface SitemapCategory {
  /** Slugs je Sprache (`locale: 'all'`). */
  slug: LocalizedValue
  updatedAt: string
}

export interface SitemapData {
  products: SitemapProduct[]
  categories: SitemapCategory[]
}

export const EMPTY_SITEMAP_DATA: SitemapData = { products: [], categories: [] }

type Entry = MetadataRoute.Sitemap[number]

/** Einträge beider Sprachen einer Route; `paramsFor` liefert die Parameter je Sprache. */
function localizedEntries(
  routeId: string,
  paramsFor: (locale: Locale) => RouteParams,
  siteUrl: string | undefined,
  lastModified?: string,
): Entry[] {
  const urlFor = (l: Locale) => absoluteUrl(localizedPath(routeId, l, paramsFor(l)), siteUrl)
  const languages = {
    ...Object.fromEntries(LOCALES.map((l) => [l, urlFor(l)])),
    'x-default': urlFor(DEFAULT_LOCALE),
  }
  return LOCALES.map((l) => ({
    url: urlFor(l),
    ...(lastModified ? { lastModified } : {}),
    alternates: { languages },
  }))
}

export function buildSitemap(
  siteUrl?: string,
  data: SitemapData = EMPTY_SITEMAP_DATA,
): MetadataRoute.Sitemap {
  const pages = pageRoutes()
    .filter((r) => r.status === 'live' && r.robots === 'index' && !r.paths!.de.includes('['))
    .flatMap((r) => localizedEntries(r.id, () => ({}), siteUrl))
  const categories = data.categories.flatMap((c) =>
    pickLocale(c.slug, DEFAULT_LOCALE)
      ? localizedEntries('R03', (l) => ({ slug: pickLocale(c.slug, l)! }), siteUrl, c.updatedAt)
      : [],
  )
  const products = data.products.flatMap((p) =>
    localizedEntries('R04', (l) => productParams(p, l), siteUrl, p.updatedAt),
  )
  return [...pages, ...categories, ...products]
}
