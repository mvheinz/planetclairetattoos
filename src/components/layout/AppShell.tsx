import { getTranslations } from 'next-intl/server'
import React from 'react'

import type { Locale } from '@/lib/routes/registry'

import styles from './AppShell.module.css'
import { PreviewBanner, previewBannerState } from './PreviewBanner'
import { SiteHeader } from './SiteHeader'

// Seitenrahmen (DESIGN KO-01): Skip-Link → SiteHeader → Vorschau-Banner → `<main id="inhalt">` → SiteFooter.
// Die Linien-Ebene (LeashLayer, P2.16) ist ein `aria-hidden`-Geschwister von `<main>` in einem
// `position: relative`-Seitencontainer, ohne Zeigerereignisse und unter dem Fußbereich.
export async function AppShell({
  locale,
  children,
  footer,
}: {
  locale: Locale
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  const t = await getTranslations({ locale, namespace: 'a11y' })
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
    </>
  )
}
