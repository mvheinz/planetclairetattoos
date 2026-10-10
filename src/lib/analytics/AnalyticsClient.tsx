'use client'

import React, { lazy, Suspense } from 'react'

// P14.13 (U-62, Ladebudget): Die Statistik-Bibliothek (~1,8 KB gz) lag im gemeinsamen Erstlade-Chunk des Layouts – auf
// jeder Seite, auch wenn die Statistik aus ist (Turbopack bündelt alle Client-Komponenten des Layouts zusammen). Als
// eigener Chunk lädt sie nur, wenn `AnalyticsSlot` sie wirklich rendert; sie zeigt nichts an und zählt den Aufruf nach
// dem Einbinden wie bisher.
const AnalyticsView = lazy(() =>
  import('./AnalyticsView').then((m) => ({ default: m.AnalyticsView })),
)

export function AnalyticsClient() {
  return (
    <Suspense fallback={null}>
      <AnalyticsView />
    </Suspense>
  )
}
