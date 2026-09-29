import { setRequestLocale } from 'next-intl/server'
import type { Metadata } from 'next'
import React from 'react'

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

type Params = { locale: string; variant: string }

export async function generateStaticParams({
  params,
}: {
  params: { locale: string }
}): Promise<{ variant: string }[]> {
  return (await shopVariantKeys(toLocale(params.locale))).map((variant) => ({ variant }))
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale, variant } = await params
  const list = variantParams('R02', variant)
  return shopMetadata(toLocale(locale), list)
}

export default async function ShopVariantPage({ params }: { params: Promise<Params> }) {
  const { locale: raw, variant } = await params
  const locale = toLocale(raw)
  const list = variantParams('R02', variant)
  setRequestLocale(locale)
  return <ListPage routeId="R02" locale={locale} list={list} />
}
