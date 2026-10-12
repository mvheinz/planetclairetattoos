import 'server-only'

import type { Where } from 'payload'

import { cached } from '@/lib/cache/cached'
import { TAGS } from '@/lib/cache/tags'
import { seedPreviewModeActive } from '@/lib/env'
import { loadTattooAvailability } from '@/lib/data/tattoo'
import { getPublicPayload } from '@/lib/payload/public'
import type { LocalizedValue } from '@/lib/products/localized'
import { productImageUrls } from '@/lib/seo/jsonld'
import type { SitemapData } from '@/lib/seo/sitemap'
import { hiddenTattooRoutes } from '@/lib/tattoo/pages'

// Daten der Sitemap (KONZEPT §2.5, P3.13): öffentliche Stücke (`available`, `reserved`, `sold` mit
// `showInArchiveAfterSale`) und die Kategorien mit Inhalt (mindestens eines dieser Stücke, V-11 – leere Kategorien
// bleiben erreichbar, stehen aber nicht in der Sitemap) mit ihren Slugs beider Sprachen und `updatedAt`. Gelesen über
// `getPublicPayload()` – der Zugriff der Collection blendet Entwürfe, Archiviertes, ausgeblendete Verkäufe und (in
// Produktion bzw. ohne SEED_PREVIEW_MODE) Seed-Stücke aus; die Bedingungen stehen hier zusätzlich (Abwehr in der
// Tiefe). Gecacht mit Tag `sitemap` (ARCHITEKTUR §9.3). Leere Tattoo-Unterseiten (Flash ohne veröffentlichtes Motiv,
// Galerie ohne sichtbares Foto) fehlen (V-28 a, V-11) – Tags `flash` und `tattoo-gallery`. V-61 b: Für Stücke im Shop
// (verfügbar oder reserviert) kommen die Fotos dazu (Größe `detail` wie im JSON-LD, nur öffentlich sichtbare Bilder – die
// Zugriffsregel der Medien blendet die übrigen aus).

const IN_SHOP: Where = { status: { in: ['available', 'reserved'] } }

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
  const [products, categories, tattoo, photos] = await Promise.all([
    payload.find({
      collection: 'products',
      where,
      locale: 'all',
      depth: 0,
      pagination: false,
      sort: 'itemNumber',
      select: { itemNumber: true, slug: true, updatedAt: true, category: true },
    }),
    payload.find({
      collection: 'categories',
      locale: 'all',
      depth: 0,
      pagination: false,
      sort: 'sortOrder',
      select: { key: true, slug: true, updatedAt: true },
    }),
    loadTattooAvailability('de'),
    payload.find({
      collection: 'products',
      where: { and: [where, IN_SHOP] },
      depth: 1,
      pagination: false,
      select: { itemNumber: true, images: true },
      populate: { media: { url: true, sizes: true } },
    }),
  ])
  const withContent = new Set(products.docs.map((d) => d.category))
  const imagesOf = new Map(
    photos.docs.map((d) => [d.itemNumber, productImageUrls(d.images as never[] | null)]),
  )
  return {
    products: products.docs.map((d) => {
      const images = imagesOf.get(d.itemNumber) ?? []
      return {
        itemNumber: d.itemNumber,
        slug: d.slug as LocalizedValue,
        updatedAt: d.updatedAt,
        ...(images.length > 0 ? { images } : {}),
      }
    }),
    categories: categories.docs
      .filter((d) => withContent.has(d.key))
      .map((d) => ({
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
