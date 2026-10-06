'use client'
/// <reference types="react/canary" />

import React, { ViewTransition, useState, useSyncExternalStore } from 'react'

import { useCurrentPreset } from '@/components/layout/useCurrentRoute'
import { getMotion, onMotionChange } from '@/leash/motion'
import { viewTransitionAllowed } from '@/leash/presets'
import type { PresetId } from '@/leash/types'

// Weiche Navigation (App Router) mit View Transitions (DESIGN §9.8, ADR 0003 Punkt 2): Seiteninhalt blendet in 250 ms
// über (Klasse `pc-page`), Coco wandert als eigenes Paar (`LeashLayer`, Name `coco`). Kein Übergang von oder zu
// `calm`-Seiten und bei reduzierter Bewegung (`default="none"`). Harte Navigation regelt `ViewTransitionOptIn`.

const subscribe = (cb: () => void) => onMotionChange(cb)
const serverMotion = () => 'reduced' as const
const allows = (p: PresetId | null) => p !== null && viewTransitionAllowed(p)

export function PageTransition({ children }: { children: React.ReactNode }) {
  const preset = useCurrentPreset()
  const motion = useSyncExternalStore(subscribe, () => getMotion(), serverMotion)
  // Vorherige Route als abgeleiteter Zustand (Übergang nur, wenn beide Seiten ihn erlauben).
  const [route, setRoute] = useState({ current: preset, previous: preset })
  if (route.current !== preset) setRoute({ current: preset, previous: route.current })
  const allowed = motion === 'full' && allows(preset) && allows(route.previous)
  return <ViewTransition default={allowed ? 'pc-page' : 'none'}>{children}</ViewTransition>
}
