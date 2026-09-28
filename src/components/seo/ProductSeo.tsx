import React from 'react'

import { listAllCategories } from '@/lib/data/categories'
import type { PublicProduct } from '@/lib/data/products'
import { getShopDisplaySettings } from '@/lib/data/shopSettings'
import type { Locale } from '@/lib/enums'
import { breadcrumbItems } from '@/lib/seo/breadcrumbs'
import {
  breadcrumbJsonLd,
  productImageUrls,
  productJsonLd,
  type PublicProductStatus,
} from '@/lib/seo/jsonld'
import { absoluteUrl } from '@/lib/seo/metadata'
import { productPath } from '@/lib/shop/format'

import { JsonLd } from './JsonLd'

// SEO-Zusätze der Produktseite R04 (KONZEPT §3.0.5, §3.4, P3.13): `og:type = product` (Next kennt den Typ nicht – React
// hebt das `<meta>` in den `<head>`), JSON-LD `Product` mit `Offer` (Steuermodus aus den Einstellungen, R-126) und
// `BreadcrumbList` Start → Shop → Kategorie → Stück.

const PUBLIC_STATUSES: readonly string[] = ['available', 'reserved', 'sold']

export async function ProductSeo({ product, locale }: { product: PublicProduct; locale: Locale }) {
  const [categories, settings] = await Promise.all([
    listAllCategories(locale),
    getShopDisplaySettings(locale),
  ])
  const category = categories.find((c) => c.key === product.category) ?? null
  const path = productPath(product, locale)
  const url = absoluteUrl(path)
  const name = product.title ?? ''
  const status = (
    PUBLIC_STATUSES.includes(product.status) ? product.status : 'sold'
  ) as PublicProductStatus
  return (
    <>
      <meta property="og:type" content="product" />
      <JsonLd
        data={productJsonLd({
          name,
          description: product.description,
          itemNumber: product.itemNumber,
          priceCents: product.priceCents,
          status,
          isSecondHand: product.isSecondHand,
          images: productImageUrls(product.images),
          url,
          taxMode: settings.taxMode,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd(
          breadcrumbItems(
            {
              routeId: 'R04',
              category: category ? { name: category.name, slug: category.slug } : null,
              title: name,
              path,
            },
            locale,
          ),
        )}
      />
    </>
  )
}
