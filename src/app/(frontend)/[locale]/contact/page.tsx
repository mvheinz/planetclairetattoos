import { getTranslations, setRequestLocale } from 'next-intl/server'
import React from 'react'

import { ContactLinks } from '@/components/content/ContactLinks'
import { PageBlocks } from '@/components/content/PageBlocks'
import { EmptyState } from '@/components/ui/EmptyState'
import { getContactInfo } from '@/lib/data/contact'
import { getPublicPage } from '@/lib/data/pages'
import { WITHDRAWAL_LINK_LABEL } from '@/lib/legal/constants'
import { localizedPath } from '@/lib/routes/paths'
import type { Locale } from '@/lib/routes/registry'
import { routeMetadata } from '@/lib/seo/metadata'

export const generateMetadata = routeMetadata('R20')

// R20 Kontakt (KONZEPT §3.13, Gerüst P2.14), Preset `margin`: Inhalt aus `pages` (`key = contact`), E-Mail und
// Instagram aus `getPublicSettings()`. Kein Kontaktformular (E-51). Fehlt die Seite, erscheint ein neutraler
// Leerzustand mit den Kontaktwegen aus den Einstellungen (DM-PAGE-01). Dazu die festen Hinweise „Vertrag widerrufen“
// und Impressum.
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale
  setRequestLocale(locale)
  const [t, tRoutes, page, contact] = await Promise.all([
    getTranslations({ locale, namespace: 'contact' }),
    getTranslations({ locale, namespace: 'common.routes' }),
    getPublicPage('contact', locale),
    getContactInfo(),
  ])

  return (
    <div className="u-container u-stack" data-contact-page="">
      <h1>{tRoutes('R20')}</h1>
      {page ? (
        <PageBlocks blocks={page.layout} locale={locale} contact={contact} />
      ) : (
        <>
          <EmptyState title={t('emptyTitle')} text={t('emptyText')} />
          <ContactLinks locale={locale} contact={contact} />
        </>
      )}
      <p>
        {t('withdrawHint')}{' '}
        <a href={localizedPath('R26', locale)} data-withdraw-cta="">
          {WITHDRAWAL_LINK_LABEL[locale]}
        </a>
      </p>
      <p>
        {t('legalNoticeHint')} <a href={localizedPath('R21', locale)}>{tRoutes('R21')}</a>
      </p>
    </div>
  )
}
