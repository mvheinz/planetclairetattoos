import React from 'react'

import { listAllCategories } from '@/lib/data/categories'
import type { PublicProduct } from '@/lib/data/products'
import { getProductInfoSettings, getShopDisplaySettings } from '@/lib/data/shopSettings'
import type { Locale } from '@/lib/enums'
import { breadcrumbItems } from '@/lib/seo/breadcrumbs'
import {
  breadcrumbJsonLd,
  productImageUrls,
  productJsonLd,
  type PublicProductStatus,
} from '@/lib/seo/jsonld'
import { absoluteUrl } from '@/lib/seo/metadata'
import { deliveryDayRange, deliveryTimeOrDefault } from '@/lib/shop/deliveryTime'
import { productPath } from '@/lib/shop/format'

import { JsonLd } from './JsonLd'

// SEO-Zusätze der Produktseite R04 (KONZEPT §3.0.5, §3.4, P3.13): `og:type = product` (Next kennt den Typ nicht – React
// hebt das `<meta>` in den `<head>`), JSON-LD `Product` mit `Offer` (Steuermodus aus den Einstellungen, R-126) und
// `BreadcrumbList` Start → Shop → Kategorie → Stück. V-61 b: Versand nach Deutschland (Preis der Versandklasse,
// Lieferzeit aus den Einstellungen; nicht bei reinen Abholstücken) und Rückgabe (Widerrufsrecht 14 Tage, E-27) im `Offer`.

const PUBLIC_STATUSES: readonly string[] = ['available', 'reserved', 'sold']

export async function ProductSeo({ product, locale }: { product: PublicProduct; locale: Locale }) {
  const [categories, settings, info] = await Promise.all([
    listAllCategories(locale),
    getShopDisplaySettings(locale),
    getProductInfoSettings(locale),
  ])
  const category = categories.find((c) => c.key === product.category) ?? null
  const path = productPath(product, locale)
  const url = absoluteUrl(path)
  const name = product.title ?? ''
  const status = (
    PUBLIC_STATUSES.includes(product.status) ? product.status : 'sold'
  ) as PublicProductStatus
  const shippingClass = product.shippingClass
  const pickupOnly = shippingClass === 'nur_abholung'
  const rateCents = shippingClass === 'nur_abholung' ? undefined : info.shippingRates[shippingClass]
  const shipping =
    typeof rateCents === 'number'
      ? {
          rateCents,
          deliveryDays: deliveryDayRange(deliveryTimeOrDefault(settings.deliveryTimeText, locale)),
        }
      : null
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
          shipping,
          returns: { byMail: !pickupOnly },
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
