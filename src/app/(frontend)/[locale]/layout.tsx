import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import React from 'react'

import { BehaviorHost } from '@/components/BehaviorHost'
import { AppShell } from '@/components/layout/AppShell'
import { PresetBody } from '@/components/layout/PresetBody'
import { routing } from '@/i18n/routing'
import { MOTION_SCRIPT } from '@/lib/security/inlineScripts'
import { fontVariables } from '@/styles/fonts'

import '@/styles/tokens.css'
import '@/styles/global.css'

// Wurzel-Layout der öffentlichen Website (ARCHITEKTUR §2.1, DESIGN KO-01): `<html lang>` gemäß Route,
// `<html data-motion>` über das feste Inline-Skript `pc-motion` im `<head>` (DESIGN §11.7; CSP-Hash in
// `src/lib/security/inlineScripts.ts`), `<body data-preset>` aus der Registry (PresetBody) und der Seitenrahmen.

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
    // `data-motion` setzt das Inline-Skript vor der Hydration – daher suppressHydrationWarning.
    <html lang={locale} className={fontVariables} suppressHydrationWarning>
      <head>
        <script id="pc-motion" dangerouslySetInnerHTML={{ __html: MOTION_SCRIPT }} />
      </head>
      <PresetBody>
        <NextIntlClientProvider>
          <AppShell locale={locale}>{children}</AppShell>
        </NextIntlClientProvider>
        <BehaviorHost />
      </PresetBody>
    </html>
  )
}
