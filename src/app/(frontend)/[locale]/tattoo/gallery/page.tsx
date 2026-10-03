import { setRequestLocale } from 'next-intl/server'
import React from 'react'

import { GalleryListPage } from '@/components/tattoo/GalleryListPage'
import { tattooLocale, tattooMetadata } from '@/components/tattoo/tattooRoute'

// R15 Galerie (KONZEPT §9.7): Grundform; `?kind=fresh|healed` liefert die statische Variante
// `tattoo/gallery/variant/[variant]` (Proxy-Umschreibung, Spike B-05). Erneuert über den Tag `tattoo-gallery`.

export const revalidate = 3600
export const generateMetadata = tattooMetadata('R15')

export default async function GalleryPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = tattooLocale((await params).locale)
  setRequestLocale(locale)
  return <GalleryListPage locale={locale} list={{}} />
}
