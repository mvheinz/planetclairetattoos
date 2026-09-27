import { NextIntlClientProvider } from 'next-intl'
import React from 'react'

import { BehaviorHost } from '@/components/BehaviorHost'
import type { Locale } from '@/lib/routes/registry'
import { MOTION_SCRIPT } from '@/lib/security/inlineScripts'
import { fontVariables } from '@/styles/fonts'

import { AppShell } from './AppShell'
import { PresetBody } from './PresetBody'
import { RouteOverride } from './RouteOverride'

import '@/styles/tokens.css'
import '@/styles/global.css'

// Dokument der öffentlichen Website (DESIGN KO-01): `<html lang>`, `<html data-motion>` über das feste Inline-Skript
// `pc-motion` im `<head>` (DESIGN §11.7; CSP-Hash in `src/lib/security/inlineScripts.ts`), `<body data-preset>` aus
// der Registry (PresetBody) und der Seitenrahmen. Genutzt vom Layout `[locale]` und von `global-not-found` (404 mit
// Kopf und Fußbereich auch ohne JavaScript, R-011/R-090).
export function SiteDocument({
  locale,
  children,
  notFound = false,
}: {
  locale: Locale
  children: React.ReactNode
  /** 404-Dokument ohne Registry-Route. */
  notFound?: boolean
}) {
  return (
    // `data-motion` setzt das Inline-Skript vor der Hydration – daher suppressHydrationWarning.
    <html lang={locale} className={fontVariables} suppressHydrationWarning>
      {/* eslint-disable-next-line @next/next/no-head-element -- App Router: Wurzel-Dokument rendert <head> selbst */}
      <head>
        <script id="pc-motion" dangerouslySetInnerHTML={{ __html: MOTION_SCRIPT }} />
      </head>
      <RouteOverride value={notFound ? null : undefined}>
        <PresetBody>
          <NextIntlClientProvider locale={locale}>
            <AppShell locale={locale}>{children}</AppShell>
          </NextIntlClientProvider>
          <BehaviorHost />
        </PresetBody>
      </RouteOverride>
    </html>
  )
}
