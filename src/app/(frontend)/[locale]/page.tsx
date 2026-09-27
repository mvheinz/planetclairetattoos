import { getTranslations, setRequestLocale } from 'next-intl/server'
import React from 'react'

import type { Locale } from '@/lib/routes/registry'

// R01 Startseite – vorläufig ohne Datenbankzugriff; die Startseite mit Beispielinhalten folgt in P2.20.
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale as Locale)
  const t = await getTranslations('home')

  return (
    <div className="u-container u-stack">
      <h1>{t('title')}</h1>
      <p>{t('intro')}</p>
    </div>
  )
}
