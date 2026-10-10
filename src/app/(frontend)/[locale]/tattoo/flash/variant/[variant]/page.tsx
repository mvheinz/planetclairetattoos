import React from 'react'

import { listVariantPage, type VariantRouteParams } from '@/components/listVariantPage'
import { FlashListPage } from '@/components/tattoo/FlashListPage'
import { tattooLocale, tattooMetadata, tattooVariantParams } from '@/components/tattoo/tattooRoute'
import { variantKey } from '@/lib/shop/listParams'

// R12 Flash – statische Filter-Variante (ARCHITEKTUR §9.1, Spike B-05): `/de/tattoo/flash?available=1` wird intern auf
// `/de/tattoo/flash/variant/available-1` umgeschrieben; sichtbare und kanonische URL bleibt die Grundform.

export const revalidate = 3600
export const dynamicParams = true

const metadata = tattooMetadata('R12')

const page = listVariantPage<VariantRouteParams>({
  locale: tattooLocale,
  list: (variant) => tattooVariantParams('R12', variant),
  staticParams: () => [{ variant: variantKey({ available: true }) }],
  metadata: (params) => metadata({ params: Promise.resolve(params) }),
  render: (locale, list) => <FlashListPage locale={locale} list={list} />,
})

export const generateStaticParams = page.generateStaticParams
export const generateMetadata = page.generateMetadata
export default page.Page
