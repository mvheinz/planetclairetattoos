import { getLocale } from 'next-intl/server'
import React from 'react'

import { NotFoundContent } from '@/components/layout/NotFoundContent'
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@/lib/routes/registry'

// R28 innerhalb des Layouts von `[locale]` (clientseitige Fälle). Serverseitig rendert Next 404-Antworten über
// `src/app/global-not-found.tsx` mit demselben Inhalt und Seitenrahmen.
export default async function NotFound() {
  const requested = await getLocale()
  const locale: Locale = (LOCALES as readonly string[]).includes(requested)
    ? (requested as Locale)
    : DEFAULT_LOCALE
  return <NotFoundContent locale={locale} />
}
