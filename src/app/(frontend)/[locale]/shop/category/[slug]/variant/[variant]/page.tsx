import React from 'react'

import { listVariantPage, type VariantRouteParams } from '@/components/listVariantPage'
import { ListPage } from '@/components/shop/ListPage'
import {
  categoryMetadata,
  categorySlugs,
  categoryVariantKeys,
  resolveCategory,
  toLocale,
  variantParams,
} from '@/components/shop/listRoutes'

// R03 Kategorie – statische Listen-Variante (`?available=1`, `?page=n`; ARCHITEKTUR §9.1, Spike B-05).

export const revalidate = 3600
export const dynamicParams = true

type Params = VariantRouteParams & { slug: string }

const page = listVariantPage<Params>({
  locale: toLocale,
  list: (variant) => variantParams('R03', variant),
  /** Parameter der Elternseite kommen nur aus Layouts – hier deshalb Kategorie und Variante zusammen. */
  staticParams: async (locale) => {
    const out: { slug: string; variant: string }[] = []
    for (const slug of await categorySlugs(locale))
      for (const variant of await categoryVariantKeys(locale, slug)) out.push({ slug, variant })
    return out
  },
  metadata: ({ locale, slug, variant }) =>
    categoryMetadata(toLocale(locale), slug, variantParams('R03', variant)),
  render: async (locale, list, { slug }) => {
    const category = await resolveCategory(locale, slug, list)
    return <ListPage routeId="R03" locale={locale} list={list} category={category} />
  },
})

export const generateStaticParams = page.generateStaticParams
export const generateMetadata = page.generateMetadata
export default page.Page
