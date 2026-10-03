'use client'

import { useSelectedLayoutSegments } from 'next/navigation'
import { useMemo } from 'react'

import { getRoute, matchSegments, type RouteMatch } from '@/lib/routes/paths'
import type { PresetId } from '@/lib/routes/registry'

import { useNotFoundShown } from './notFoundState'
import { usePageError } from './pageError'
import { useRouteOverride } from './RouteOverride'

/**
 * Aktuelle Registry-Route für Komponenten im Layout von `[locale]` (Preset am `<body>`, aktive Navigation,
 * Kopflinien-Variante, Sprachumschalter). Nutzt die Layout-Segmente statt der URL: Die Ordner sind die EN-Pfade
 * (ARCHITEKTUR §2.3), damit ist das Ergebnis auf Server und Client gleich und statisch renderbar. Eine feste Route aus
 * `RouteOverride` (404-Dokument) hat Vorrang.
 */
export function useCurrentRoute(): RouteMatch | null {
  const override = useRouteOverride()
  const notFoundShown = useNotFoundShown()
  const segments = useSelectedLayoutSegments()
  const key = segments.join('/')
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` bildet die Segmente vollständig ab
  const match = useMemo(() => matchSegments(segments), [key])
  if (override !== undefined) return override
  // 404-Inhalt unter einer Registry-Route (`notFound()` einer Seite): keine Route → R28, Preset `lost`.
  return notFoundShown ? null : match
}

/** Preset von R28 (404): gilt für jede Adresse ohne Registry-Route (`[...rest]`, `global-not-found`). */
export const NOT_FOUND_PRESET: PresetId | null = getRoute('R28').preset

/**
 * Preset der aktuellen Seite (DESIGN §9.7): aus der Registry; ohne Registry-Route das 404-Preset `lost`; während die
 * 500-Seite (R29) steht, keins (keine Engine, keine Animation); ebenso auf QA-Seiten.
 */
export function useCurrentPreset(): PresetId | null {
  const match = useCurrentRoute()
  const errored = usePageError()
  const firstSegment = useSelectedLayoutSegments()[0]
  const notFoundShown = useNotFoundShown()
  const qa = firstSegment === 'qa' && !notFoundShown
  // QA-Seiten (KUNST-QA §3.2, nur ART_QA): keine Registry-Route, aber auch keine 404 – Linie nur, wo die Seite selbst
  // eine `LeashLayer` mit festem Preset rendert.
  if (errored || (qa && !match)) return null
  return match ? match.route.preset : NOT_FOUND_PRESET
}
