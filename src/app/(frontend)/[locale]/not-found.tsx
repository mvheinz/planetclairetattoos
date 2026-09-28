import { getLocale } from 'next-intl/server'
import type { Metadata } from 'next'
import React from 'react'

import { NotFoundContent } from '@/components/layout/NotFoundContent'
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@/lib/routes/registry'
import { notFoundMetadata } from '@/lib/seo/metadata'

// R28 innerhalb des Layouts von `[locale]` (clientseitige Fälle, z. B. `notFound()` des Fehler-Auslösers außerhalb von
// APP_ENV=test). Unbekannte Adressen rendert Next serverseitig über `src/app/global-not-found.tsx` mit demselben Inhalt
// und Seitenrahmen. Kein `[...rest]`-Auffang (P2.19): `notFound()` aus einer Seite unter dem dynamischen Wurzel-Layout
// `[locale]` liefert in Next 16.3 nur eine leere Fehler-Hülle ohne HTML (Inhalt erst mit JavaScript) – der
// `global-not-found`-Weg liefert dagegen echten Status 404 mit vollständigem HTML.
async function currentLocale(): Promise<Locale> {
  const requested = await getLocale()
  return (LOCALES as readonly string[]).includes(requested) ? (requested as Locale) : DEFAULT_LOCALE
}

// 404 innerhalb von `[locale]` (z. B. unbekannte Kategorie, Listenseite hinter der letzten): `noindex`, ohne
// canonical/hreflang (P3.13).
export async function generateMetadata(): Promise<Metadata> {
  return notFoundMetadata(await currentLocale())
}

export default async function NotFound() {
  return <NotFoundContent locale={await currentLocale()} />
}
