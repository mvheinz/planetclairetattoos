'use client'

import { useEffect } from 'react'

import { readQaSwitches } from '@/lib/qa/switches'

// Laufzeit der QA-Schalter (KUNST-QA §3.1, P9.1). Rendert nichts; SiteDocument bindet sie nur bei `ART_QA=1` ein (in
// Produktion also nie). `?freeze=1`: `html[data-motion="reduced"]` (Boil aus, Linie/Coco sofort im Endzustand, alle
// Verhaltensmodule statisch) plus `html[data-qa-freeze]`; endliche Animationen werden laufend auf ihr Ende gesetzt,
// endlose angehalten. `?qa-jank=30`: 30 ms Busy-Loop je Frame (künstliche Last, PF-12).
export function QaRuntime() {
  useEffect(() => {
    const doc = document
    const sw = readQaSwitches(doc)
    const stops: (() => void)[] = []
    if (sw.freeze) {
      const html = doc.documentElement
      html.setAttribute('data-motion', 'reduced')
      html.setAttribute('data-qa-freeze', '')
      const settle = () => {
        for (const a of doc.getAnimations()) {
          const end = a.effect?.getComputedTiming().endTime
          try {
            if (typeof end === 'number' && Number.isFinite(end)) a.finish()
            else {
              a.pause()
              a.currentTime = 0
            }
          } catch {
            // Animation ohne Zeitachse (z. B. bereits abgebrochen) – ignorieren.
          }
        }
      }
      settle()
      const id = window.setInterval(settle, 50)
      stops.push(() => window.clearInterval(id))
    }
    if (sw.jankMs > 0) {
      let raf = 0
      const burn = () => {
        const until = performance.now() + sw.jankMs
        while (performance.now() < until) {
          // künstliche Last (Busy-Loop)
        }
        raf = requestAnimationFrame(burn)
      }
      raf = requestAnimationFrame(burn)
      stops.push(() => cancelAnimationFrame(raf))
    }
    return () => {
      for (const s of stops) s()
    }
  }, [])
  return null
}
