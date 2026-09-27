import { getTranslations, setRequestLocale } from 'next-intl/server'
import React from 'react'

import type { Locale } from '@/lib/routes/registry'

// Gerüst einer Route (KONZEPT §2.2 „Gerüst P2“): Überschrift und gekennzeichneter Platzhalter. Den Inhalt liefern
// P2.13/P2.14 bzw. die in der Registry genannte Phase.
export async function ScaffoldPage({
  params,
  routeId,
}: {
  params: Promise<{ locale: string }>
  routeId: string
}) {
  const { locale } = await params
  setRequestLocale(locale as Locale)
  const t = await getTranslations('common')

  return (
    <div className="u-container u-stack">
      <h1>{t(`routes.${routeId}` as 'routes.R01')}</h1>
      <p>{t('scaffoldNotice')}</p>
    </div>
  )
}
