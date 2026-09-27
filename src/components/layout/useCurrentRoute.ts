'use client'

import { useSelectedLayoutSegments } from 'next/navigation'
import { useMemo } from 'react'

import { matchSegments, type RouteMatch } from '@/lib/routes/paths'

/**
 * Aktuelle Registry-Route für Komponenten im Layout von `[locale]` (Preset am `<body>`, aktive Navigation,
 * Kopflinien-Variante, Sprachumschalter). Nutzt die Layout-Segmente statt der URL: Die Ordner sind die EN-Pfade
 * (ARCHITEKTUR §2.3), damit ist das Ergebnis auf Server und Client gleich und statisch renderbar.
 */
export function useCurrentRoute(): RouteMatch | null {
  const segments = useSelectedLayoutSegments()
  const key = segments.join('/')
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` bildet die Segmente vollständig ab
  return useMemo(() => matchSegments(segments), [key])
}
