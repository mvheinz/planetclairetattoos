import 'server-only'

import type { Where } from 'payload'

import { cached } from '@/lib/cache/cached'
import { TAGS } from '@/lib/cache/tags'
import { seedPreviewModeActive } from '@/lib/env'
import { getPublicPayload } from '@/lib/payload/public'
import type { LocalizedValue } from '@/lib/products/localized'
import type { SitemapData } from '@/lib/seo/sitemap'

// Daten der Sitemap (KONZEPT §2.5, P3.13): öffentliche Stücke (`available`, `reserved`, `sold` mit
// `showInArchiveAfterSale`) und alle Kategorien mit ihren Slugs beider Sprachen und `updatedAt`. Gelesen über
// `getPublicPayload()` – der Zugriff der Collection blendet Entwürfe, Archiviertes, ausgeblendete Verkäufe und (in
// Produktion bzw. ohne SEED_PREVIEW_MODE) Seed-Stücke aus; die Bedingungen stehen hier zusätzlich (Abwehr in der
// Tiefe). Gecacht mit Tag `sitemap` (ARCHITEKTUR §9.3).

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
  const [products, categories] = await Promise.all([
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
  }
}

export const getSitemapData = cached(loadSitemapData, {
  key: 'sitemap-data',
  tags: [TAGS.sitemap, TAGS.products, TAGS.categories],
})
