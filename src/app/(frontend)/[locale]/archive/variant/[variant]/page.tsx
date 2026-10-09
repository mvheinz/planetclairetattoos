import React from 'react'

import { listVariantPage, type VariantRouteParams } from '@/components/listVariantPage'
import { ListPage } from '@/components/shop/ListPage'
import {
  archiveMetadata,
  archiveVariantKeys,
  toLocale,
  variantParams,
} from '@/components/shop/listRoutes'

// R05 Archiv – statische Listen-Variante (`?category=<slug>`, `?page=n`; ARCHITEKTUR §9.1, Spike B-05). Unbekannte
// Kategorie wird ignoriert (AK-3-09): ganze Liste, canonical ohne `category`.

export const revalidate = 3600
export const dynamicParams = true

const page = listVariantPage<VariantRouteParams>({
  locale: toLocale,
  list: (variant) => variantParams('R05', variant),
  staticParams: async (locale) =>
    (await archiveVariantKeys(locale)).map((variant) => ({ variant })),
  metadata: ({ locale, variant }) =>
    archiveMetadata(toLocale(locale), variantParams('R05', variant)),
  render: (locale, list) => <ListPage routeId="R05" locale={locale} list={list} />,
})

export const generateStaticParams = page.generateStaticParams
export const generateMetadata = page.generateMetadata
export default page.Page
