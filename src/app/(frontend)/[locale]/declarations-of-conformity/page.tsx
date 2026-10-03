import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server'
import React from 'react'

import { PageBlocks } from '@/components/content/PageBlocks'
import { EmptyState } from '@/components/ui/EmptyState'
import { getActiveConformity } from '@/lib/data/conformity'
import { getPublicPage } from '@/lib/data/pages'
import { localizedPath } from '@/lib/routes/paths'
import type { Locale } from '@/lib/routes/registry'
import { routeMetadata } from '@/lib/seo/metadata'

export const generateMetadata = routeMetadata('R27')

// R27 Konformitätserklärungen (KONZEPT §3.14): Einleitung aus `pages` (`key = conformity`, falls vorhanden) und die
// Liste der aktiven Erklärungen (Glasur, gültig ab, PDF). Ohne Einträge der neutrale Satz; die Seite bleibt erreichbar
// (kein Fußlink); ohne Erklärungen als Leerzustand KO-17 mit Link zur Keramik (P8.16). Kein Platzhalter-Band: hier steht kein Rechtstext der Kanzlei (docs/OFFENE-PUNKTE.md, P2.13).
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale
  setRequestLocale(locale)
  const [t, tRoutes, format, page, items] = await Promise.all([
    getTranslations({ locale, namespace: 'legal.conformity' }),
    getTranslations({ locale, namespace: 'common.routes' }),
    getFormatter({ locale }),
    getPublicPage('conformity', locale),
    getActiveConformity(locale),
  ])
  const date = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: 'long', timeZone: 'Europe/Berlin' })

  return (
    <div className="u-container u-stack" data-legal-page="R27">
      <h1>{tRoutes('R27')}</h1>
      <PageBlocks blocks={page?.layout} locale={locale} />
      {items.length > 0 ? (
        <ul data-conformity-list="">
          {items.map((item) => (
            <li key={item.id} id={`glaze-${item.id}`}>
              <strong>{item.name}</strong> · {t('validFrom', { date: date(item.validFrom) })}
              {item.pdfUrl ? (
                <>
                  {' · '}
                  <a href={item.pdfUrl}>{t('pdf', { name: item.name })}</a>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div data-conformity-empty="">
          <EmptyState
            title={t('emptyTitle')}
            text={t('empty')}
            action={{
              href: localizedPath('R03', locale, {
                slug: locale === 'en' ? 'ceramics' : 'keramik',
              }),
              label: t('emptyAction'),
            }}
          />
        </div>
      )}
    </div>
  )
}
