import { setRequestLocale } from 'next-intl/server'
import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import React from 'react'

import { toLocale } from '@/components/shop/listRoutes'
import { ProductPage } from '@/components/shop/product/ProductPage'
import {
  getPublicProductByItemNumber,
  loadPublicProductSlugs,
  type PublicProduct,
} from '@/lib/data/products'
import type { Locale } from '@/lib/enums'
import { buildMetadata } from '@/lib/seo/metadata'
import { productMetaDescription, productPageTitle } from '@/lib/seo/product'
import { parseProductSegment, productParams, productPath, productSegment } from '@/lib/shop/format'

// R04 Produktseite (KONZEPT §2.3, §3.4): Auflösung nur über die führenden Ziffern des Segments. Nicht kanonische Form
// (andere Auffüllung, alter Slug, Slug der anderen Sprache, kein Slug) → 308 auf `productPath()`; Entwurf, archiviert
// oder unbekannt → 404; verkauft und ausgeblendet → 404-Variante „Zuhause“ (`not-found.tsx` + Layout). ISR für alle
// öffentlichen Stücke, weitere Nummern bei Bedarf (`dynamicParams`).

export const revalidate = 3600
export const dynamicParams = true

type Params = { locale: string; product: string }

export async function generateStaticParams({
  params,
}: {
  params: { locale: string }
}): Promise<{ product: string }[]> {
  const locale = toLocale(params.locale)
  return (await loadPublicProductSlugs()).map((p) => ({ product: productSegment(p, locale) }))
}

async function resolve(locale: Locale, raw: string): Promise<PublicProduct | null> {
  const nr = parseProductSegment(decodeURIComponent(raw))
  return nr === null ? null : getPublicProductByItemNumber(nr, locale)
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale: raw, product: segment } = await params
  const locale = toLocale(raw)
  const product = await resolve(locale, segment)
  // 404-Variante: Metadaten aus `not-found.tsx` (noindex, ohne canonical/hreflang, P3.13).
  if (!product) notFound()
  const other: Locale = locale === 'de' ? 'en' : 'de'
  const alternate = await getPublicProductByItemNumber(product.itemNumber, other)
  return buildMetadata('R04', locale, productParams(product, locale), {
    title: productPageTitle(product, locale),
    description: productMetaDescription(product),
    alternateParams: alternate ? { [other]: productParams(alternate, other) } : undefined,
    ogType: 'product',
    ogImage: false,
  })
}

export default async function ProductRoute({ params }: { params: Promise<Params> }) {
  const { locale: raw, product: segment } = await params
  const locale = toLocale(raw)
  setRequestLocale(locale)
  const product = await resolve(locale, segment)
  if (!product) notFound()
  if (decodeURIComponent(segment) !== productSegment(product, locale))
    permanentRedirect(productPath(product, locale))
  return <ProductPage product={product} locale={locale} />
}
