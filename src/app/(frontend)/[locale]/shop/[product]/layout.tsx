import React from 'react'

import { ProductSeo } from '@/components/seo/ProductSeo'
import { toLocale } from '@/components/shop/listRoutes'
import { ProductGoneProvider } from '@/components/shop/product/productGone'
import { getPublicProductByItemNumber, isProductGone } from '@/lib/data/products'
import { parseProductSegment } from '@/lib/shop/format'

// R04: Das Layout kennt die Parameter (die 404 des Segments nicht) und meldet, ob die Nummer zu einem verkauften,
// ausgeblendeten Stück gehört – dann zeigt `not-found.tsx` die Variante „Zuhause“ (KONZEPT §2.3). Öffentliche Stücke
// fragen nichts zusätzlich ab (gleicher zwischengespeicherter Aufruf wie die Seite). Für öffentliche Stücke hängt das
// Layout die SEO-Zusätze an (`og:type = product`, JSON-LD `Product` + `BreadcrumbList`, P3.13).

type Params = { locale: string; product: string }

export default async function ProductLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<Params>
}) {
  const { locale: raw, product: segment } = await params
  const locale = toLocale(raw)
  const nr = parseProductSegment(decodeURIComponent(segment))
  const product = nr === null ? null : await getPublicProductByItemNumber(nr, locale)
  const gone = nr !== null && !product && (await isProductGone(nr))
  return (
    <ProductGoneProvider gone={gone}>
      {product ? <ProductSeo product={product} locale={locale} /> : null}
      {children}
    </ProductGoneProvider>
  )
}
