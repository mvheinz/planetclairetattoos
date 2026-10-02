import { setRequestLocale } from 'next-intl/server'
import React from 'react'

import { FlashListPage } from '@/components/tattoo/FlashListPage'
import { tattooLocale, tattooMetadata, tattooVariantParams } from '@/components/tattoo/tattooRoute'
import { variantKey } from '@/lib/shop/listParams'

// R12 Flash – statische Filter-Variante (ARCHITEKTUR §9.1, Spike B-05): `/de/tattoo/flash?available=1` wird intern auf
// `/de/tattoo/flash/variant/available-1` umgeschrieben; sichtbare und kanonische URL bleibt die Grundform.

export const revalidate = 3600
export const dynamicParams = true

type Params = { locale: string; variant: string }

export function generateStaticParams(): { variant: string }[] {
  return [{ variant: variantKey({ available: true }) }]
}

export const generateMetadata = tattooMetadata('R12')

export default async function FlashVariantPage({ params }: { params: Promise<Params> }) {
  const { locale: raw, variant } = await params
  const locale = tattooLocale(raw)
  const list = tattooVariantParams('R12', variant)
  setRequestLocale(locale)
  return <FlashListPage locale={locale} list={list} />
}
