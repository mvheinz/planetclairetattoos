import 'server-only'

import type { Where } from 'payload'

import { cached } from '@/lib/cache/cached'
import { TAGS } from '@/lib/cache/tags'
import { seedPreviewModeActive } from '@/lib/env'
import { loadTattooAvailability } from '@/lib/data/tattoo'
import { getPublicPayload } from '@/lib/payload/public'
import type { LocalizedValue } from '@/lib/products/localized'
import type { SitemapData } from '@/lib/seo/sitemap'
import { hiddenTattooRoutes } from '@/lib/tattoo/pages'

// Daten der Sitemap (KONZEPT §2.5, P3.13): öffentliche Stücke (`available`, `reserved`, `sold` mit
// `showInArchiveAfterSale`) und alle Kategorien mit ihren Slugs beider Sprachen und `updatedAt`. Gelesen über
// `getPublicPayload()` – der Zugriff der Collection blendet Entwürfe, Archiviertes, ausgeblendete Verkäufe und (in
// Produktion bzw. ohne SEED_PREVIEW_MODE) Seed-Stücke aus; die Bedingungen stehen hier zusätzlich (Abwehr in der
// Tiefe). Gecacht mit Tag `sitemap` (ARCHITEKTUR §9.3). Leere Tattoo-Unterseiten (Flash ohne veröffentlichtes Motiv,
// Galerie ohne sichtbares Foto) fehlen (V-28 a, V-11) – Tags `flash` und `tattoo-gallery`.

const PUBLIC_PRODUCTS: Where = {
  or: [
    { status: { in: ['available', 'reserved'] } },
    {
      and: [{ status: { equals: 'sold' } }, { showInArchiveAfterSale: { equals: true } }],
    },
  ],
}

export async function loadSitemapData(): Promise<SitemapData> {
  const payload = await getPublicPayload()
  const where: Where = seedPreviewModeActive()
    ? PUBLIC_PRODUCTS
    : { and: [PUBLIC_PRODUCTS, { seed: { not_equals: true } }] }
  const [products, categories, tattoo] = await Promise.all([
    payload.find({
      collection: 'products',
      where,
      locale: 'all',
      depth: 0,
      pagination: false,
      sort: 'itemNumber',
      select: { itemNumber: true, slug: true, updatedAt: true },
    }),
    payload.find({
      collection: 'categories',
      locale: 'all',
      depth: 0,
      pagination: false,
      sort: 'sortOrder',
      select: { slug: true, updatedAt: true },
    }),
    loadTattooAvailability('de'),
  ])
  return {
    products: products.docs.map((d) => ({
      itemNumber: d.itemNumber,
      slug: d.slug as LocalizedValue,
      updatedAt: d.updatedAt,
    })),
    categories: categories.docs.map((d) => ({
      slug: d.slug as LocalizedValue,
      updatedAt: d.updatedAt,
    })),
    hiddenRoutes: hiddenTattooRoutes(tattoo),
  }
}

export const getSitemapData = cached(loadSitemapData, {
  key: 'sitemap-data',
  tags: [TAGS.sitemap, TAGS.products, TAGS.categories, TAGS.flash, TAGS.tattooGallery],
})
