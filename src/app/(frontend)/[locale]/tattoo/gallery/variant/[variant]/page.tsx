import { setRequestLocale } from 'next-intl/server'
import React from 'react'

import { GalleryListPage } from '@/components/tattoo/GalleryListPage'
import { tattooLocale, tattooMetadata, tattooVariantParams } from '@/components/tattoo/tattooRoute'
import { GALLERY_KINDS, variantKey } from '@/lib/shop/listParams'

// R15 Galerie – statische Filter-Variante (ARCHITEKTUR §9.1, Spike B-05): `/de/tattoo/galerie?kind=healed` wird intern
// auf `/de/tattoo/gallery/variant/kind-healed` umgeschrieben; sichtbare und kanonische URL bleibt die Grundform.

export const revalidate = 3600
export const dynamicParams = true

type Params = { locale: string; variant: string }

export function generateStaticParams(): { variant: string }[] {
  return GALLERY_KINDS.map((kind) => ({ variant: variantKey({ kind }) }))
}

export const generateMetadata = tattooMetadata('R15')

export default async function GalleryVariantPage({ params }: { params: Promise<Params> }) {
  const { locale: raw, variant } = await params
  const locale = tattooLocale(raw)
  const list = tattooVariantParams('R15', variant)
  setRequestLocale(locale)
  return <GalleryListPage locale={locale} list={list} />
}
