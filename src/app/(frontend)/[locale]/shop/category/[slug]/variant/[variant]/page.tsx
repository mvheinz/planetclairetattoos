import { setRequestLocale } from 'next-intl/server'
import type { Metadata } from 'next'
import React from 'react'

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

type Params = { locale: string; slug: string; variant: string }

/** Parameter der Elternseite kommen nur aus Layouts – hier deshalb Kategorie und Variante zusammen. */
export async function generateStaticParams({
  params,
}: {
  params: { locale: string }
}): Promise<{ slug: string; variant: string }[]> {
  const locale = toLocale(params.locale)
  const out: { slug: string; variant: string }[] = []
  for (const slug of await categorySlugs(locale))
    for (const variant of await categoryVariantKeys(locale, slug)) out.push({ slug, variant })
  return out
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale, slug, variant } = await params
  return categoryMetadata(toLocale(locale), slug, variantParams('R03', variant))
}

export default async function CategoryVariantPage({ params }: { params: Promise<Params> }) {
  const { locale: raw, slug, variant } = await params
  const locale = toLocale(raw)
  const list = variantParams('R03', variant)
  setRequestLocale(locale)
  const category = await resolveCategory(locale, slug, list)
  return <ListPage routeId="R03" locale={locale} list={list} category={category} />
}
