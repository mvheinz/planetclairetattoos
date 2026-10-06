'use client'

import React, { useEffect, useRef } from 'react'

import { useCurrentPreset } from '@/components/layout/useCurrentRoute'
import { getMotion, onMotionChange, type Motion } from '@/leash/motion'
import { viewTransitionAllowed } from '@/leash/presets'

// View Transitions bei harter Navigation (DESIGN §9.8, ADR 0003): `@view-transition { navigation: auto }` nur unter
// `prefers-reduced-motion: no-preference`, nur auf Seiten mit Preset, das Übergänge erlaubt (nie `calm`: Korb, Kasse,
// Bestellstatus, Widerruf). Beide Dokumente müssen zustimmen – fehlt die Regel auf einer Seite, gibt es keinen
// Übergang hinein oder hinaus. Bei `html[data-motion="reduced"]` (Schalter) wird die Regel abgeschaltet.

export const VIEW_TRANSITION_CSS =
  '@media (prefers-reduced-motion: no-preference){@view-transition{navigation:auto}}'
const MEDIA_ON = '(prefers-reduced-motion: no-preference)'

export function ViewTransitionOptIn() {
  const ref = useRef<HTMLStyleElement>(null)
  const preset = useCurrentPreset()
  const allowed = preset !== null && viewTransitionAllowed(preset)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const apply = (m: Motion) => {
      el.media = m === 'reduced' ? 'not all' : MEDIA_ON
    }
    apply(getMotion())
    return onMotionChange(apply)
  }, [allowed])

  if (!allowed) return null
  return (
    <style ref={ref} media={MEDIA_ON} data-view-transition="">
      {VIEW_TRANSITION_CSS}
    </style>
  )
}
