import { getTranslations } from 'next-intl/server'
import React from 'react'

import { getSiteNavigation } from '@/lib/data/navigation'
import type { Locale } from '@/lib/routes/registry'

import styles from './AppShell.module.css'
import { MenuOverlay } from './MenuOverlay'
import { PreviewBanner, previewBannerState } from './PreviewBanner'
import { SiteHeader } from './SiteHeader'

// Seitenrahmen (DESIGN KO-01): Skip-Link → SiteHeader → Vorschau-Banner → `<main id="inhalt">` → SiteFooter.
// Die Linien-Ebene (LeashLayer, P2.16) ist ein `aria-hidden`-Geschwister von `<main>` in einem
// `position: relative`-Seitencontainer, ohne Zeigerereignisse und unter dem Fußbereich. Das Menü (`<dialog>`, KO-03)
// steht am Ende und öffnet sich im Top-Layer.
export async function AppShell({
  locale,
  children,
  footer,
}: {
  locale: Locale
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  const [t, nav] = await Promise.all([
    getTranslations({ locale, namespace: 'a11y' }),
    getSiteNavigation(locale),
  ])
  return (
    <>
      <a href="#inhalt" className={styles.skip}>
        {t('skipToContent')}
      </a>
      <SiteHeader locale={locale} />
      <PreviewBanner locale={locale} state={previewBannerState()} />
      <div className={styles.page}>
        <div className={`${styles.leash} u-layer-leash`} data-leash-layer="" aria-hidden="true" />
        <main id="inhalt" tabIndex={-1} className={styles.main}>
          {children}
        </main>
      </div>
      {footer}
      <MenuOverlay locale={locale} nav={nav} />
    </>
  )
}
