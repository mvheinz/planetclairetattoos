import { setRequestLocale } from 'next-intl/server'
import type { Metadata } from 'next'
import React from 'react'

import { ListPage } from '@/components/shop/ListPage'
import {
  categoryMetadata,
  categorySlugs,
  resolveCategory,
  toLocale,
} from '@/components/shop/listRoutes'

// R03 Kategorie (KONZEPT §3.3): wie R02, gefiltert auf eine Kategorie; H1 = Kategoriename, Einleitung aus
// `categories.intro`. Unbekannter Slug → 404, Slug der anderen Sprache → 308 auf den richtigen Slug (KONZEPT §2.4).

export const revalidate = 3600
export const dynamicParams = true

type Params = { locale: string; slug: string }

export async function generateStaticParams({
  params,
}: {
  params: { locale: string }
}): Promise<{ slug: string }[]> {
  return (await categorySlugs(toLocale(params.locale))).map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale, slug } = await params
  return categoryMetadata(toLocale(locale), slug, {})
}

export default async function CategoryPage({ params }: { params: Promise<Params> }) {
  const { locale: raw, slug } = await params
  const locale = toLocale(raw)
  setRequestLocale(locale)
  const category = await resolveCategory(locale, slug, {})
  return <ListPage routeId="R03" locale={locale} list={{}} category={category} />
}
