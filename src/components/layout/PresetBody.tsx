'use client'

import React from 'react'

import { useCurrentRoute } from './useCurrentRoute'

// `<body data-preset>` aus der Routen-Registry (DESIGN KO-01, §9.7): das Preset steuert Linien-Rinne und Ruhe-Modus.
// `data-route` trägt die Routen-ID (z. B. für Tests und die Linie). Unbekannte Pfade (404) ohne Preset (P2.19).
export function PresetBody({ children }: { children: React.ReactNode }) {
  const match = useCurrentRoute()
  return (
    <body data-preset={match?.route.preset ?? undefined} data-route={match?.route.id ?? undefined}>
      {children}
    </body>
  )
}
