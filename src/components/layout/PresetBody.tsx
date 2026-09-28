'use client'

import React from 'react'

import { usePageError } from './pageError'
import { useCurrentPreset, useCurrentRoute } from './useCurrentRoute'

// `<body data-preset>` aus der Routen-Registry (DESIGN KO-01, §9.7): das Preset steuert Linien-Rinne und Ruhe-Modus.
// `data-route` trägt die Routen-ID (z. B. für Tests und die Linie). Pfade ohne Registry-Route sind 404 (R28, Preset
// `lost`); solange die 500-Seite steht, `data-route="R29"` ohne Preset und `data-page-error` (Ruhe, KO-18).
export function PresetBody({ children }: { children: React.ReactNode }) {
  const match = useCurrentRoute()
  const preset = useCurrentPreset()
  const errored = usePageError()
  const route = errored ? 'R29' : (match?.route.id ?? 'R28')
  return (
    <body
      data-preset={preset ?? undefined}
      data-route={route}
      data-page-error={errored ? '' : undefined}
    >
      {children}
    </body>
  )
}
