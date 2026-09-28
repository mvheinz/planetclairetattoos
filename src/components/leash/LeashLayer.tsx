'use client'

import React, { useEffect, useRef } from 'react'

import { useCurrentRoute } from '@/components/layout/useCurrentRoute'
import { onMotionChange } from '@/leash/motion'
import { isStaticPreset } from '@/leash/presets'
import { whenLeashReady } from '@/leash/schedule'
import type { RouteMatch } from '@/lib/routes/paths'

// Linien-Ebene (DESIGN §9.1, §9.2, §9.9): leerer, `aria-hidden` Container im Seitencontainer. Die Engine lädt erst
// nach dem LCP + 300 ms (spätestens `load` + 1200 ms) per Idle-Callback als eigener Chunk und wird bei jedem
// Routenwechsel abgebaut und neu eingehängt (§9.12). Ruhe-Presets (`calm`, `legal`) laden die Laufzeit nie, sondern nur
// den statischen Renderer (Stufe C, ≤ 4 KB gz, §9.10); bei reduzierter Bewegung zeichnet die Laufzeit über denselben
// Renderer sofort vollständig (§9.11).

/** Routen-Schlüssel ohne Sprache: Routen-ID plus sprachunabhängige Parameter (Seed der Linie, §9.3). */
export function leashRouteKey(match: RouteMatch): string {
  const params = Object.entries(match.params)
    .filter(([k]) => k !== 'slug')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
  return [match.route.id, ...params].join('/')
}

export function LeashLayer({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const match = useCurrentRoute()
  const preset = match?.route.preset ?? null
  const routeKey = match ? leashRouteKey(match) : ''

  useEffect(() => {
    const el = ref.current
    if (!el || !preset) return
    let cancelled = false
    const cleanups: (() => void)[] = []
    const cancelWait = whenLeashReady(() => {
      const load = isStaticPreset(preset)
        ? import('@/leash/static').then((mod) => mod.mountStaticLeash)
        : import('@/leash/runtime').then((mod) => mod.mountLeash)
      void load.then((mount) => {
        if (cancelled) return
        const handle = mount(el, { preset, routeKey })
        cleanups.push(() => handle.destroy())
        cleanups.push(onMotionChange((m) => handle.setMotion(m)))
        // Test-Schnittstelle nur bei NEXT_PUBLIC_LEASH_DEBUG=1 (DESIGN §9.13): Next ersetzt den Ausdruck beim Build durch
        // eine Konstante; steht er direkt an der Bedingung, entfällt der Import samt Chunk (kein `__leash` im Build).
        // eslint-disable-next-line no-restricted-properties -- öffentliche Build-Konstante, kein getEnv() im Browser
        if (process.env.NEXT_PUBLIC_LEASH_DEBUG === '1')
          void import('@/leash/debug').then(({ exposeLeashDebug }) => {
            if (!cancelled) cleanups.push(exposeLeashDebug(handle))
          })
      })
    })
    return () => {
      cancelled = true
      cancelWait()
      for (const c of cleanups.splice(0).reverse()) c()
    }
  }, [preset, routeKey])

  return (
    <div
      ref={ref}
      className={className}
      data-leash-layer=""
      data-leash-preset={preset ?? undefined}
      aria-hidden="true"
    />
  )
}
