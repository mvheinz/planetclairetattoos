import React from 'react'

import { listVariantPage, type VariantRouteParams } from '@/components/listVariantPage'
import { ListPage } from '@/components/shop/ListPage'
import {
  shopMetadata,
  shopVariantKeys,
  toLocale,
  variantParams,
} from '@/components/shop/listRoutes'

// R02 Shop – statische Listen-Variante (ARCHITEKTUR §9.1, Spike B-05). Der Proxy schreibt `/de/shop?available=1&page=2`
// intern auf `/de/shop/variant/available-1.page-2` um; die sichtbare und kanonische URL bleibt die Query-Form.
// Bekannte Kombinationen werden beim Build vorgerendert, weitere beim ersten Aufruf (ISR, `dynamicParams`).

export const revalidate = 3600
export const dynamicParams = true

const page = listVariantPage<VariantRouteParams>({
  locale: toLocale,
  list: (variant) => variantParams('R02', variant),
  staticParams: async (locale) => (await shopVariantKeys(locale)).map((variant) => ({ variant })),
  metadata: ({ locale, variant }) => shopMetadata(toLocale(locale), variantParams('R02', variant)),
  render: (locale, list) => <ListPage routeId="R02" locale={locale} list={list} />,
})

export const generateStaticParams = page.generateStaticParams
export const generateMetadata = page.generateMetadata
export default page.Page
