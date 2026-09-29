import { setRequestLocale } from 'next-intl/server'
import type { Metadata } from 'next'
import React from 'react'

import { ListPage } from '@/components/shop/ListPage'
import { shopMetadata, toLocale } from '@/components/shop/listRoutes'

// R02 Shop (KONZEPT §3.2): Grundform ohne Parameter; `?available=1` und `?page=n` liefert die statische Variante
// `shop/variant/[variant]` (Proxy-Umschreibung, Spike B-05). ISR, gezielte Erneuerung über die Tags (§9.3).

export const revalidate = 3600

type Params = { locale: string }

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  return shopMetadata(toLocale((await params).locale), {})
}

export default async function ShopPage({ params }: { params: Promise<Params> }) {
  const locale = toLocale((await params).locale)
  setRequestLocale(locale)
  return <ListPage routeId="R02" locale={locale} list={{}} />
}
