import { getLocale } from 'next-intl/server'
import type { Metadata } from 'next'
import React from 'react'

import { NotFoundContent } from '@/components/layout/NotFoundContent'
import { ProductNotFoundSwitch } from '@/components/shop/product/productGone'
import { toLocale } from '@/components/shop/listRoutes'
import { getPublicProductByItemNumber, isProductGone } from '@/lib/data/products'
import { notFoundMetadata } from '@/lib/seo/metadata'
import { parseProductSegment } from '@/lib/shop/format'

// 404 der Produktseite (KONZEPT §2.3, DESIGN KO-18): unbekannt, Entwurf oder archiviert → „Coco hat sich losgerissen“;
// verkauft und ausgeblendet → „Dieses Stück hat schon ein Zuhause gefunden“ (HTTP 404, `noindex`, Links Shop und
// Archiv, Preset `lost` ohne Weglaufen). Die Wahl trifft das Layout (`ProductGoneProvider`).
// Metadaten der 404-Variante (P3.13): Titel je Variante, `noindex`, kein canonical/hreflang.
export async function generateMetadata({
  params,
}: {
  params?: Promise<{ locale?: string; product?: string }>
}): Promise<Metadata> {
  const p = (await params) ?? {}
  const locale = toLocale(p.locale ?? (await getLocale()))
  const nr = p.product ? parseProductSegment(decodeURIComponent(p.product)) : null
  const gone =
    nr !== null && !(await getPublicProductByItemNumber(nr, locale)) && (await isProductGone(nr))
  return notFoundMetadata(locale, gone ? 'home' : 'lost')
}

export default async function ProductNotFound() {
  const locale = toLocale(await getLocale())
  return (
    <ProductNotFoundSwitch
      lost={<NotFoundContent locale={locale} />}
      home={<NotFoundContent locale={locale} variant="home" />}
    />
  )
}
