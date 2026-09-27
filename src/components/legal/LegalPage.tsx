import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server'
import React from 'react'

import { RichTextContent } from '@/components/content/RichTextContent'
import { Callout } from '@/components/ui/Callout'
import { EmptyState } from '@/components/ui/EmptyState'
import { PlaceholderBanner } from '@/components/ui/PlaceholderBanner'
import { getLegalText, type LegalTextView } from '@/lib/data/legal'
import type { LegalTextType } from '@/lib/enums'
import { localizedPath } from '@/lib/routes/paths'
import type { Locale } from '@/lib/routes/registry'

import styles from './LegalPage.module.css'

// Rechtsseiten R21–R25 (KONZEPT §3.14, Gerüst P2.13): serverseitig gerendert aus der gültigen `legal-texts`-Fassung,
// Tokens ersetzt (R-012), genau eine `h1` (R-010). Band „PLATZHALTER – nicht rechtsverbindlich“ oben, solange ein
// gezeigter Text nicht von der Kanzlei stammt oder ein Text fehlt (R-002). Fehlt eine Fassung: neutraler Leerzustand.
// Preset `legal`: keine Animation, keine Transition (AK-DS-11). PDF-Downloads und der Übersetzungs-Hinweis
// `translation.disclaimer` folgen in P6.

export async function LegalPage({
  params,
  routeId,
  types,
  children,
}: {
  params: Promise<{ locale: string }>
  routeId: string
  types: readonly LegalTextType[]
  /** Zusatz unter den Texten (z. B. Link „Vertrag widerrufen“ auf R24). */
  children?: React.ReactNode
}) {
  const { locale: raw } = await params
  const locale = raw as Locale
  setRequestLocale(locale)
  const [tRoutes, views] = await Promise.all([
    getTranslations({ locale, namespace: 'common.routes' }),
    Promise.all(types.map((type) => getLegalText(type, locale))),
  ])
  const showBanner = views.some((v) => v.state !== 'ok' || v.isPlaceholder)

  return (
    <div className={'u-container u-stack'} data-legal-page={routeId}>
      {showBanner ? <PlaceholderBanner /> : null}
      <h1>{tRoutes(routeId as 'R21')}</h1>
      {views.map((view) => (
        <LegalTextSection key={view.type} view={view} locale={locale} />
      ))}
      {children}
    </div>
  )
}

async function LegalTextSection({ view, locale }: { view: LegalTextView; locale: Locale }) {
  const [t, format] = await Promise.all([
    getTranslations({ locale, namespace: 'legal' }),
    getFormatter({ locale }),
  ])
  if (view.state !== 'ok') {
    return (
      <EmptyState
        title={t('emptyTitle')}
        text={t('emptyText')}
        action={{ href: localizedPath('R20', locale), label: t('emptyAction') }}
      />
    )
  }
  const date = format.dateTime(new Date(view.validFrom), {
    dateStyle: 'long',
    timeZone: 'Europe/Berlin',
  })
  return (
    <section className={styles.text} data-legal-text={view.type}>
      {view.germanOnly ? (
        <Callout variant="info">
          <p>{t('germanOnly')}</p>
        </Callout>
      ) : null}
      <p className={styles.asOf} data-legal-as-of="">
        {t('asOf', { date })}
      </p>
      <div lang={view.germanOnly ? 'de' : undefined}>
        <RichTextContent data={view.content} />
      </div>
    </section>
  )
}
