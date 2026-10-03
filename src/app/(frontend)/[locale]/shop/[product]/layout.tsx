import React from 'react'

import { ProductSeo } from '@/components/seo/ProductSeo'
import { toLocale } from '@/components/shop/listRoutes'
import { productNotFoundState } from '@/components/shop/product/productNotFound'
import { getPublicProductByItemNumber, isProductGone } from '@/lib/data/products'
import { parseProductSegment } from '@/lib/shop/format'

// R04: Das Layout kennt die Parameter (die 404 des Segments nicht) und trägt ein, welche 404-Variante gilt: keine
// (öffentliches Stück), „Zuhause“ (verkauft und ausgeblendet) oder „Coco hat sich losgerissen“ (KONZEPT §2.3);
// `not-found.tsx` liest das über `productNotFoundState()`. Öffentliche Stücke fragen nichts zusätzlich ab (gleicher
// zwischengespeicherter Aufruf wie die Seite). Für öffentliche Stücke hängt das Layout die SEO-Zusätze an
// (`og:type = product`, JSON-LD `Product` + `BreadcrumbList`, P3.13).

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
  productNotFoundState().variant = product ? null : gone ? 'home' : 'lost'
  return (
    <>
      {product ? <ProductSeo product={product} locale={locale} /> : null}
      {children}
    </>
  )
}
