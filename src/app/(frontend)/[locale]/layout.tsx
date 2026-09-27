import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import React from 'react'

import { BehaviorHost } from '@/components/BehaviorHost'
import { routing } from '@/i18n/routing'
import { fontVariables } from '@/styles/fonts'

import '@/styles/tokens.css'
import '@/styles/global.css'

// Wurzel-Layout der öffentlichen Website (ARCHITEKTUR §2.1): setzt `<html lang>` gemäß Route. Kopf, Fuß, Banner und
// Tuschelinie folgen in P2.8 ff.

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
    <html lang={locale} className={fontVariables}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
        <BehaviorHost />
      </body>
    </html>
  )
}
