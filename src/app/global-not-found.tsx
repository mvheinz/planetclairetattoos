import { getLocale, getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import React from 'react'

import { NotFoundContent } from '@/components/layout/NotFoundContent'
import { SiteDocument } from '@/components/layout/SiteDocument'
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@/lib/routes/registry'

// 404 (R28) für die ganze App (Next `experimental.globalNotFound`): Die öffentliche Website hat ihr Wurzel-Layout unter
// `[locale]` (mehrere Wurzel-Layouts); ohne dieses Dokument lieferte Next bei `notFound()` eine leere Fehler-Hülle,
// die erst mit JavaScript den Inhalt zeigt. So stehen Kopf und Fußbereich mit „Vertrag widerrufen“ (R-011, R-090)
// schon im HTML. Die Sprache kommt aus dem Proxy (next-intl), sonst Deutsch.

async function currentLocale(): Promise<Locale> {
  const requested = await getLocale().catch(() => DEFAULT_LOCALE)
  return (LOCALES as readonly string[]).includes(requested) ? (requested as Locale) : DEFAULT_LOCALE
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale()
  const t = await getTranslations({ locale, namespace: 'errors' })
  return { title: `${t('notFoundTitle')} · Planet Claire`, robots: { index: false } }
}

export default async function GlobalNotFound() {
  const locale = await currentLocale()
  return (
    <SiteDocument locale={locale} notFound>
      <NotFoundContent locale={locale} />
    </SiteDocument>
  )
}
