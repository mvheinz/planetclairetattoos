import { getTranslations, setRequestLocale } from 'next-intl/server'
import React from 'react'

import { getSiteNavigation, instagramUrl } from '@/lib/data/navigation'
import type { Locale } from '@/lib/routes/registry'
import { organizationJsonLd, serializeJsonLd } from '@/lib/seo/jsonLd'
import { routeMetadata } from '@/lib/seo/metadata'

export const generateMetadata = routeMetadata('R01')

// R01 Startseite – vorläufig ohne Seiteninhalte aus der Datenbank; die Startseite mit Beispielinhalten folgt in P2.20.
// Organization-JSON-LD (KONZEPT §3.0.5, ohne Adresse, E-50).
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale as Locale)
  const [t, nav] = await Promise.all([getTranslations('home'), getSiteNavigation(locale as Locale)])

  return (
    <div className="u-container u-stack">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(organizationJsonLd(instagramUrl(nav.instagramHandle))),
        }}
      />
      <h1>{t('title')}</h1>
      <p>{t('intro')}</p>
    </div>
  )
}
