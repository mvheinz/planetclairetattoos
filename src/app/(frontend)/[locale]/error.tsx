'use client'

import React, { lazy, Suspense, useEffect } from 'react'

import { useErrorTexts } from '@/components/errors/ErrorTexts'
import { enterPageError } from '@/components/layout/pageError'

// R29 „Hoppla – die Leine hat sich verheddert“ (DESIGN KO-18, KONZEPT §3.17): statisches Knäuel aus 3 Schlingen,
// Coco `kopfschief` (xl, Frame A, ohne Boil), Knopf „Nochmal versuchen“ und Link zur Startseite. Das Fehler-Boundary
// liegt im Layout von `[locale]`: Kopf und Fußbereich (inkl. „Vertrag widerrufen“, R-011/R-090) bleiben stehen.
// Keine Animation: Die Seite meldet sich als Fehlerzustand an (`pageError`) – kein Preset, keine Linien-Engine,
// `body[data-page-error]` schaltet Übergänge im Inhalt ab. „Nochmal versuchen“ nutzt `retry()` (Next 16.3: lädt die
// Daten neu), sonst `reset()`.
// Ansicht erst im Fehlerfall laden (ServerErrorView) – das Boundary selbst gehört zum Erstlade-JS jeder Seite.
const ServerErrorView = lazy(() => import('@/components/errors/ServerErrorView'))

export default function ErrorPage({
  reset,
  retry,
}: {
  error: Error & { digest?: string }
  reset: () => void
  retry?: () => void
}) {
  // Texte serverseitig übersetzt aus dem Layout (ErrorTextsProvider in SiteDocument).
  const texts = useErrorTexts()
  useEffect(() => enterPageError(), [])

  return (
    <Suspense fallback={null}>
      <ServerErrorView texts={texts} onRetry={() => (retry ?? reset)()} />
    </Suspense>
  )
}
