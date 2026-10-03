'use client'
/// <reference types="react/canary" />

import React, { ViewTransition, useEffect, useRef } from 'react'

import { Coco } from '@/components/Coco'
import { useCurrentPreset, useCurrentRoute } from '@/components/layout/useCurrentRoute'
import type { CocoController } from '@/leash/coco'
import { getMotion, onMotionChange } from '@/leash/motion'
import { PRESET_CONFIG, REST_POSE, isStaticPreset } from '@/leash/presets'
import type { InspectableLeashHandle, MountOptions } from '@/leash/runtime'
import { whenLeashReady } from '@/leash/schedule'
import { readQaSwitches } from '@/lib/qa/switches'
import type { RouteMatch } from '@/lib/routes/paths'
import type { PresetId } from '@/lib/routes/registry'

// Linien-Ebene (DESIGN §9.1, §9.2, §9.9): leerer, `aria-hidden` Container im Seitencontainer. Die Engine lädt erst
// nach dem LCP + 300 ms (spätestens `load` + 1200 ms) per Idle-Callback als eigener Chunk und wird bei jedem
// Routenwechsel abgebaut und neu eingehängt (§9.12). Ruhe-Presets (`calm`, `legal`) laden die Laufzeit nie, sondern nur
// den statischen Renderer (Stufe C, ≤ 4 KB gz, §9.10); bei reduzierter Bewegung zeichnet die Laufzeit über denselben
// Renderer sofort vollständig (§9.11).
// Coco an der Leinenspitze (Presets mit `coco.size = 'leash'`, §9.7): SSR-Element am Linienanfang (ohne JS
// unsichtbar), ab dem Laden der Engine von der Coco-Steuerung (`src/leash/coco.ts`) geführt. Für View Transitions
// trägt es den Namen `coco` (harte Navigation per CSS, weiche per React-`<ViewTransition>`, ADR 0003).

/** Routen-Schlüssel ohne Sprache: Routen-ID plus sprachunabhängige Parameter (Seed der Linie, §9.3). */
export function leashRouteKey(match: RouteMatch): string {
  const params = Object.entries(match.params)
    .filter(([k]) => k !== 'slug')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
  return [match.route.id, ...params].join('/')
}

/** Ohne JavaScript keine Coco an der (fehlenden) Linie (§9.4 „ohne JS“). */
const NOSCRIPT_CSS = '.coco[data-leash-coco]{display:none}'

export function LeashLayer({
  className,
  preset: presetOverride,
  routeKey: routeKeyOverride,
}: {
  className?: string
  /** Nur QA-Seiten (`/qa/leash`, `/qa/motion`, KUNST-QA §3.2): festes Preset statt Registry-Route. */
  preset?: PresetId
  /** Nur QA-Seiten: Seed-Schlüssel der Linie. */
  routeKey?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const cocoRef = useRef<HTMLDivElement>(null)
  const match = useCurrentRoute()
  const routePreset = useCurrentPreset()
  const preset = presetOverride ?? routePreset
  // Ohne Registry-Route (404): fester Schlüssel `R28` – gleiche lose Leine auf jeder unbekannten Adresse.
  const routeKey = routeKeyOverride ?? (match ? leashRouteKey(match) : 'R28')
  const cocoOnLeash = preset !== null && PRESET_CONFIG[preset].coco?.size === 'leash'

  useEffect(() => {
    const el = ref.current
    if (!el || !preset) return
    // `?leash=off` (nur mit ART_QA, KUNST-QA §3.1): Grundlinie ohne Engine – kein Laufzeit- und kein Coco-Chunk.
    if (readQaSwitches().leashOff) return
    let cancelled = false
    const cleanups: (() => void)[] = []
    const cancelWait = whenLeashReady(() => {
      const cocoEl = cocoOnLeash ? cocoRef.current : null
      const load = isStaticPreset(preset)
        ? import('@/leash/static').then((mod) => ({ mount: mod.mountStaticLeash, coco: null }))
        : Promise.all([
            import('@/leash/runtime'),
            cocoEl ? import('@/leash/coco') : Promise.resolve(null),
          ]).then(([runtime, coco]) => ({ mount: runtime.mountLeash, coco }))
      void load.then(({ mount, coco: cocoMod }) => {
        if (cancelled) return
        const rest = REST_POSE[preset] ?? 'sitzen'
        let handle: InspectableLeashHandle | null = null
        let coco: CocoController | null = null
        if (cocoMod && cocoEl) {
          coco = cocoMod.mountCoco(cocoEl, {
            pose: rest,
            motion: getMotion(),
            onPose: (e) => handle?.notePose(e),
          })
          cleanups.push(() => coco?.destroy())
        }
        const options: MountOptions = { preset, routeKey }
        if (coco) {
          const c = coco
          options.cocoPose = () => c.pose()
          options.onCoco = (s) => {
            c.setPose(s.pose)
            if (s.moving) c.activity()
            c.place(s.x, s.y, s.direction)
            cocoEl?.setAttribute('data-placed', '')
          }
        }
        handle = mount(el, options)
        const h = handle
        cleanups.push(() => h.destroy())
        cleanups.push(
          onMotionChange((m) => {
            coco?.setMotion(m, rest)
            h.setMotion(m)
          }),
        )
        // Test-Schnittstelle nur bei NEXT_PUBLIC_LEASH_DEBUG=1 (DESIGN §9.13): Next ersetzt den Ausdruck beim Build durch
        // eine Konstante; steht er direkt an der Bedingung, entfällt der Import samt Chunk (kein `__leash` im Build).
        // eslint-disable-next-line no-restricted-properties -- öffentliche Build-Konstante, kein getEnv() im Browser
        if (process.env.NEXT_PUBLIC_LEASH_DEBUG === '1')
          void import('@/leash/debug').then(({ exposeLeashDebug }) => {
            if (!cancelled) cleanups.push(exposeLeashDebug(h))
          })
      })
    })
    return () => {
      cancelled = true
      cancelWait()
      for (const c of cleanups.splice(0).reverse()) c()
    }
  }, [preset, routeKey, cocoOnLeash])

  return (
    <>
      <div
        ref={ref}
        className={className}
        data-leash-layer=""
        data-leash-preset={preset ?? undefined}
        aria-hidden="true"
      />
      {cocoOnLeash ? (
        <>
          <noscript>
            <style>{NOSCRIPT_CSS}</style>
          </noscript>
          {/* Neuer Schlüssel je Route: alte und neue Coco bilden bei weicher Navigation ein Paar (`share`). */}
          <ViewTransition key={routeKey} name="coco" share="pc-coco" default="none">
            <Coco ref={cocoRef} pose="sitzen" size="leash" data={{ 'data-leash-coco': '' }} />
          </ViewTransition>
        </>
      ) : null}
    </>
  )
}
