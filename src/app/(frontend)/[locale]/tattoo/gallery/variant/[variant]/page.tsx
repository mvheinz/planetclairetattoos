import React from 'react'

import { listVariantPage, type VariantRouteParams } from '@/components/listVariantPage'
import { GalleryListPage } from '@/components/tattoo/GalleryListPage'
import { tattooLocale, tattooMetadata, tattooVariantParams } from '@/components/tattoo/tattooRoute'
import { GALLERY_KINDS, variantKey } from '@/lib/shop/listParams'

// R15 Galerie – statische Filter-Variante (ARCHITEKTUR §9.1, Spike B-05): `/de/tattoo/galerie?kind=healed` wird intern
// auf `/de/tattoo/gallery/variant/kind-healed` umgeschrieben; sichtbare und kanonische URL bleibt die Grundform.

export const revalidate = 3600
export const dynamicParams = true

const metadata = tattooMetadata('R15')

const page = listVariantPage<VariantRouteParams>({
  locale: tattooLocale,
  list: (variant) => tattooVariantParams('R15', variant),
  staticParams: () => GALLERY_KINDS.map((kind) => ({ variant: variantKey({ kind }) })),
  metadata: (params) => metadata({ params: Promise.resolve(params) }),
  render: (locale, list) => <GalleryListPage locale={locale} list={list} />,
})

export const generateStaticParams = page.generateStaticParams
export const generateMetadata = page.generateMetadata
export default page.Page
