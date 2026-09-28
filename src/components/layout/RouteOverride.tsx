'use client'

import React, { createContext, useContext } from 'react'

import type { RouteMatch } from '@/lib/routes/paths'

// Feste Route für Dokumente außerhalb des normalen Routings: `global-not-found` (404 ohne Layout-Segmente) setzt `null`
// („keine Registry-Route“), damit Preset, aktive Navigation und Sprachumschalter nicht die Startseite annehmen.
const RouteOverrideContext = createContext<RouteMatch | null | undefined>(undefined)

export function RouteOverride({
  value,
  children,
}: {
  value: RouteMatch | null | undefined
  children: React.ReactNode
}) {
  return <RouteOverrideContext.Provider value={value}>{children}</RouteOverrideContext.Provider>
}

export const useRouteOverride = () => useContext(RouteOverrideContext)
