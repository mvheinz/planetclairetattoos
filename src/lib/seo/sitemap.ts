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
// Leere Tattoo-Unterseiten (`hiddenRoutes`: Flash ohne Motiv, Galerie ohne Foto) fehlen; erreichbar bleiben sie.
// V-61 b (U-93): Stücke im Shop (verfügbar oder reserviert) nennen ihre Fotos als `<image:image>` (Bildersuche); verkaufte
// nicht. Next.js schreibt die Adressen unverändert ins XML – deshalb hier absolut und XML-maskiert (`&` → `&amp;`).

export interface SitemapProduct {
  itemNumber: number
  /** Slugs je Sprache (`locale: 'all'`); fehlt EN, gilt der DE-Slug. */
  slug: LocalizedValue
  updatedAt: string
  /** Foto-Adressen (relativ oder absolut) – nur bei Stücken im Shop (V-61 b). */
  images?: readonly string[]
}

export interface SitemapCategory {
  /** Slugs je Sprache (`locale: 'all'`). */
  slug: LocalizedValue
  updatedAt: string
}

export interface SitemapData {
  products: SitemapProduct[]
  categories: SitemapCategory[]
  /** Seiten ohne Inhalt, die nicht in die Sitemap gehören (leere Tattoo-Unterseiten, V-28 a/V-11). */
  hiddenRoutes?: readonly string[]
}

export const EMPTY_SITEMAP_DATA: SitemapData = { products: [], categories: [] }

type Entry = MetadataRoute.Sitemap[number]

/** Höchstens so viele Fotos je Seite (Google: bis 1000; ein Stück hat bis zu 12 Fotos). */
export const SITEMAP_MAX_IMAGES = 12

/** Zeichen, die im XML-Text maskiert werden müssen (Next.js maskiert die Bild-Adressen nicht). */
export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Absolute, maskierte Foto-Adressen eines Stücks (doppelte entfernt, höchstens `SITEMAP_MAX_IMAGES`). */
export function sitemapImages(images: readonly string[] | undefined, siteUrl?: string): string[] {
  const out = [...new Set((images ?? []).filter(Boolean).map((u) => absoluteUrl(u, siteUrl)))]
  return out.slice(0, SITEMAP_MAX_IMAGES).map(xmlEscape)
}

/** Einträge beider Sprachen einer Route; `paramsFor` liefert die Parameter je Sprache. */
function localizedEntries(
  routeId: string,
  paramsFor: (locale: Locale) => RouteParams,
  siteUrl: string | undefined,
  lastModified?: string,
  images: readonly string[] = [],
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
    ...(images.length > 0 ? { images: [...images] } : {}),
  }))
}

export function buildSitemap(
  siteUrl?: string,
  data: SitemapData = EMPTY_SITEMAP_DATA,
): MetadataRoute.Sitemap {
  const hidden = new Set(data.hiddenRoutes ?? [])
  const pages = pageRoutes()
    .filter(
      (r) =>
        r.status === 'live' &&
        r.robots === 'index' &&
        !r.paths!.de.includes('[') &&
        !hidden.has(r.id),
    )
    .flatMap((r) => localizedEntries(r.id, () => ({}), siteUrl))
  const categories = data.categories.flatMap((c) =>
    pickLocale(c.slug, DEFAULT_LOCALE)
      ? localizedEntries('R03', (l) => ({ slug: pickLocale(c.slug, l)! }), siteUrl, c.updatedAt)
      : [],
  )
  const products = data.products.flatMap((p) =>
    localizedEntries(
      'R04',
      (l) => productParams(p, l),
      siteUrl,
      p.updatedAt,
      sitemapImages(p.images, siteUrl),
    ),
  )
  return [...pages, ...categories, ...products]
}
