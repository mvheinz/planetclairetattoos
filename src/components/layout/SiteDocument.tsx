import { getTranslations } from 'next-intl/server'
import React from 'react'

import { BehaviorHost } from '@/components/BehaviorHost'
import { ErrorTextsProvider } from '@/components/errors/ErrorTexts'
import { ViewTransitionOptIn } from '@/components/leash/ViewTransitionOptIn'
import { QaRuntime } from '@/components/qa/QaRuntime'
import { artQaActive } from '@/lib/env'
import { QA_META_NAME } from '@/lib/qa/switches'
import type { Locale } from '@/lib/routes/registry'
import { MOTION_SCRIPT } from '@/lib/security/inlineScripts'
import { fontVariables } from '@/styles/fonts'

import { AppShell } from './AppShell'
import { PresetBody } from './PresetBody'
import { RouteOverride } from './RouteOverride'

import '@/styles/tokens.css'
import '@/styles/global.css'
import '@/styles/coco.css'

// Dokument der öffentlichen Website (DESIGN KO-01): `<html lang>`, `<html data-motion>` und das Schriften-Tor
// `<html data-fonts>` (DESIGN §4.1) über das feste Inline-Skript `pc-motion` im `<head>` (DESIGN §11.7; CSP-Hash in
// `src/lib/security/inlineScripts.ts`), `<body data-preset>` aus der Registry (PresetBody) und der Seitenrahmen.
// Genutzt vom Layout `[locale]` und von `global-not-found` (404 mit Kopf und Fußbereich auch ohne JavaScript,
// R-011/R-090).
export async function SiteDocument({
  locale,
  children,
  notFound = false,
}: {
  locale: Locale
  children: React.ReactNode
  /** 404-Dokument ohne Registry-Route. */
  notFound?: boolean
}) {
  const t = await getTranslations({ locale, namespace: 'errors' })
  const errorTexts = {
    locale,
    serverErrorTitle: t('serverErrorTitle'),
    serverErrorText: t('serverErrorText'),
    retry: t('retry'),
    toHome: t('toHome'),
  }
  // QA-Modus der Kunst-Abnahme (KUNST-QA §3.1): Marke für die Query-Schalter, nie in Produktion (`artQaActive`).
  const artQa = artQaActive()
  return (
    // `data-motion`/`data-fonts` setzt das Inline-Skript vor der Hydration – daher suppressHydrationWarning.
    <html lang={locale} className={fontVariables} suppressHydrationWarning>
      {/* eslint-disable-next-line @next/next/no-head-element -- App Router: Wurzel-Dokument rendert <head> selbst */}
      <head>
        <script id="pc-motion" dangerouslySetInnerHTML={{ __html: MOTION_SCRIPT }} />
        {artQa ? <meta name={QA_META_NAME} content="1" /> : null}
      </head>
      <RouteOverride value={notFound ? null : undefined}>
        <PresetBody>
          {/* Kein NextIntlClientProvider: Client-Komponenten bekommen Texte als Props bzw. die Fehlertexte über
              ErrorTextsProvider (Erstlade-Budget ARCHITEKTUR §7.7, P2.23). */}
          <ErrorTextsProvider value={errorTexts}>
            <AppShell locale={locale}>{children}</AppShell>
          </ErrorTextsProvider>
          <BehaviorHost />
          <ViewTransitionOptIn />
          {artQa ? <QaRuntime /> : null}
        </PresetBody>
      </RouteOverride>
    </html>
  )
}
