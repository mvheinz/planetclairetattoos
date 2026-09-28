import { getTranslations } from 'next-intl/server'
import React from 'react'

import { getSiteNavigation } from '@/lib/data/navigation'
import { LeashLayer } from '@/components/leash/LeashLayer'
import { PageTransition } from '@/components/leash/PageTransition'
import type { Locale } from '@/lib/routes/registry'

import styles from './AppShell.module.css'
import { MenuOverlay } from './MenuOverlay'
import { PreviewBanner, previewBannerState } from './PreviewBanner'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'

// Seitenrahmen (DESIGN KO-01): Skip-Link → SiteHeader → Vorschau-Banner → `<main id="inhalt">` → SiteFooter.
// Die Linien-Ebene (LeashLayer, DESIGN §9.1) ist ein `aria-hidden`-Geschwister von `<main>` in einem
// `position: relative`-Seitencontainer, ohne Zeigerereignisse und unter dem Fußbereich. Das Menü (`<dialog>`, KO-03)
// steht am Ende und öffnet sich im Top-Layer.
export async function AppShell({
  locale,
  children,
}: {
  locale: Locale
  children: React.ReactNode
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
        <LeashLayer className={`${styles.lineLayer} u-layer-leash`} />
        <main id="inhalt" tabIndex={-1} className={styles.main}>
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <SiteFooter locale={locale} nav={nav} />
      <MenuOverlay locale={locale} nav={nav} />
    </>
  )
}
