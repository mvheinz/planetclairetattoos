import { setRequestLocale } from 'next-intl/server'
import type { Metadata } from 'next'
import React from 'react'

import { ListPage } from '@/components/shop/ListPage'
import { archiveMetadata, toLocale } from '@/components/shop/listRoutes'

// R05 Archiv (KONZEPT §3.5; DE `/de/archiv`, EN `/en/archive`): alle `sold` mit `showInArchiveAfterSale = true`, nach
// `soldAt` absteigend, 24 je Seite, Stempel statisch. `?category=<slug>` und `?page=n` liefert die statische Variante
// `archive/variant/[variant]` (Proxy-Umschreibung, Spike B-05). ISR, gezielte Erneuerung über die Tags (§9.3).

export const revalidate = 3600

type Params = { locale: string }

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  return archiveMetadata(toLocale((await params).locale), {})
}

export default async function ArchivePage({ params }: { params: Promise<Params> }) {
  const locale = toLocale((await params).locale)
  setRequestLocale(locale)
  return <ListPage routeId="R05" locale={locale} list={{}} />
}
