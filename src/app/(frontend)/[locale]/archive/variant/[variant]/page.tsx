import { setRequestLocale } from 'next-intl/server'
import type { Metadata } from 'next'
import React from 'react'

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

type Params = { locale: string; variant: string }

export async function generateStaticParams({
  params,
}: {
  params: { locale: string }
}): Promise<{ variant: string }[]> {
  return (await archiveVariantKeys(toLocale(params.locale))).map((variant) => ({ variant }))
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale, variant } = await params
  return archiveMetadata(toLocale(locale), variantParams('R05', variant))
}

export default async function ArchiveVariantPage({ params }: { params: Promise<Params> }) {
  const { locale: raw, variant } = await params
  const locale = toLocale(raw)
  const list = variantParams('R05', variant)
  setRequestLocale(locale)
  return <ListPage routeId="R05" locale={locale} list={list} />
}
