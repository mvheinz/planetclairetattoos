import { getLocale } from 'next-intl/server'
import React from 'react'

import { NotFoundContent } from '@/components/layout/NotFoundContent'
import { ProductNotFoundSwitch } from '@/components/shop/product/productGone'
import { toLocale } from '@/components/shop/listRoutes'

// 404 der Produktseite (KONZEPT §2.3, DESIGN KO-18): unbekannt, Entwurf oder archiviert → „Coco hat sich losgerissen“;
// verkauft und ausgeblendet → „Dieses Stück hat schon ein Zuhause gefunden“ (HTTP 404, `noindex`, Links Shop und
// Archiv, Preset `lost` ohne Weglaufen). Die Wahl trifft das Layout (`ProductGoneProvider`).
export default async function ProductNotFound() {
  const locale = toLocale(await getLocale())
  return (
    <ProductNotFoundSwitch
      lost={<NotFoundContent locale={locale} />}
      home={<NotFoundContent locale={locale} variant="home" />}
    />
  )
}
