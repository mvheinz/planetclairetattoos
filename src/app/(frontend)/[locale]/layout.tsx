import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import React from 'react'

import { AnalyticsSlot } from '@/lib/analytics/AnalyticsSlot'
import { ClientErrorSlot } from '@/components/monitoring/ClientErrorSlot'
import { SiteDocument } from '@/components/layout/SiteDocument'
import { routing } from '@/i18n/routing'

// Wurzel-Layout der öffentlichen Website (ARCHITEKTUR §2.1, DESIGN KO-01): `<html lang>` gemäß Route, Inline-Skript
// `pc-motion`, `<body data-preset>` und Seitenrahmen über `SiteDocument`.

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale: hasLocale(routing.locales, locale) ? locale : 'de' })
  return { title: t('common.siteName'), description: t('home.intro') }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)
  return (
    <SiteDocument locale={locale}>
      {children}
      <ClientErrorSlot />
      <AnalyticsSlot />
    </SiteDocument>
  )
}
