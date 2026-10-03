import { setRequestLocale } from 'next-intl/server'
import React from 'react'

import { FlashListPage } from '@/components/tattoo/FlashListPage'
import { tattooLocale, tattooMetadata } from '@/components/tattoo/tattooRoute'

// R12 Flash (KONZEPT §9.3): Grundform ohne Filter; `?available=1` liefert die statische Variante
// `tattoo/flash/variant/[variant]` (Proxy-Umschreibung, Spike B-05). Erneuert über den Tag `flash`.

export const revalidate = 3600
export const generateMetadata = tattooMetadata('R12')

export default async function FlashPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = tattooLocale((await params).locale)
  setRequestLocale(locale)
  return <FlashListPage locale={locale} list={{}} />
}
