'use client'

import { usePathname } from 'next/navigation'
import React, { lazy, Suspense } from 'react'

import type { Locale } from '@/lib/routes/registry'
import { fontVariables } from '@/styles/fonts'

import '@/styles/tokens.css'
import '@/styles/global.css'
import '@/styles/coco.css'

// R29 für Fehler im Wurzel-Layout selbst (Next `global-error`): ersetzt das ganze Dokument, daher eigenes `<html>`/
// `<body>`, eigene Stile und Texte direkt aus den Sprachdateien (kein Layout, kein Provider). Gleiche Gestaltung wie
// `[locale]/error.tsx` (Knäuel, Coco `kopfschief`, „Nochmal versuchen“, keine Animation) plus schlichter Fußbereich mit
// „Vertrag widerrufen“ und den Pflichtlinks (R-011, R-090).

// Inhalt (Texte beider Sprachen, Zeichnung) wird erst im Fehlerfall nachgeladen (ARCHITEKTUR §7.7, P2.23).
const GlobalErrorContent = lazy(() => import('@/components/errors/GlobalErrorContent'))

/** Sprache aus dem Pfad; Standard DE (DEFAULT_LOCALE – ohne Registry-Import, Erstlade-Budget). */
function localeOf(pathname: string | null): Locale {
  return pathname && /^\/en(\/|$)/.test(pathname) ? 'en' : 'de'
}

export default function GlobalError({
  reset,
  retry,
}: {
  error: Error & { digest?: string }
  reset: () => void
  retry?: () => void
}) {
  const locale = localeOf(usePathname())
  return (
    <html lang={locale} className={fontVariables}>
      <body data-route="R29" data-page-error="">
        <Suspense fallback={null}>
          <GlobalErrorContent locale={locale} onRetry={() => (retry ?? reset)()} />
        </Suspense>
      </body>
    </html>
  )
}
