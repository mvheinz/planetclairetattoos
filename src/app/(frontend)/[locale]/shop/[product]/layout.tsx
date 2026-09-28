import React from 'react'

import { toLocale } from '@/components/shop/listRoutes'
import { ProductGoneProvider } from '@/components/shop/product/productGone'
import { getPublicProductByItemNumber, isProductGone } from '@/lib/data/products'
import { parseProductSegment } from '@/lib/shop/format'

// R04: Das Layout kennt die Parameter (die 404 des Segments nicht) und meldet, ob die Nummer zu einem verkauften,
// ausgeblendeten Stück gehört – dann zeigt `not-found.tsx` die Variante „Zuhause“ (KONZEPT §2.3). Öffentliche Stücke
// fragen nichts zusätzlich ab (gleicher zwischengespeicherter Aufruf wie die Seite).

type Params = { locale: string; product: string }

export default async function ProductLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<Params>
}) {
  const { locale, product } = await params
  const nr = parseProductSegment(decodeURIComponent(product))
  const gone =
    nr !== null &&
    !(await getPublicProductByItemNumber(nr, toLocale(locale))) &&
    (await isProductGone(nr))
  return <ProductGoneProvider gone={gone}>{children}</ProductGoneProvider>
}
