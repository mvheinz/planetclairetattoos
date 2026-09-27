'use client'

import { useTranslations } from 'next-intl'
import React from 'react'

// R29 „Hoppla – die Leine hat sich verheddert“ – Grundform. Das Fehler-Boundary liegt im Layout von `[locale]`, Kopf
// und Fußbereich (inkl. „Vertrag widerrufen“, R-011/R-090) bleiben stehen. Knäuel-SVG, Coco, Knopf-Optik und
// Fehler-Auslöser ergänzt P2.19 (DESIGN KO-18). Keine Animation.
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('errors')
  return (
    <div className="u-container u-stack">
      <h1>{t('serverErrorTitle')}</h1>
      <button type="button" onClick={reset}>
        {t('retry')}
      </button>
    </div>
  )
}
