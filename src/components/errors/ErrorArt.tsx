import React from 'react'

import {
  CARABINER_GATE_PATH,
  CARABINER_LEASH_PATH,
  CARABINER_RING_PATH,
  CARABINER_VIEWBOX,
  HARNESS_RING_PATH,
  HARNESS_STRAP_PATH,
  KNOT_PATH,
  KNOT_VIEWBOX,
} from '@/art/errorArt'

// Statische Zeichnungen der Fehlerseiten (DESIGN KO-18) als Server-SVG, `aria-hidden`, feste Größe (kein CLS).
// Tusche = `--ink`, Geschirr = `--coco-harness`; erzwungene Farben → `CanvasText` (ErrorPages.module.css).

/** 500: Knäuel aus 3 Schlingen, statisch. */
export function KnotArt({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${KNOT_VIEWBOX.w} ${KNOT_VIEWBOX.h}`}
      width={KNOT_VIEWBOX.w}
      height={KNOT_VIEWBOX.h}
      aria-hidden="true"
      focusable="false"
      data-error-knot=""
    >
      <path className="pc-ink" d={KNOT_PATH} />
    </svg>
  )
}

/** 404: Leinenende – offener Karabiner, leeres rotes Geschirr. */
export function LeashEndArt({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${CARABINER_VIEWBOX.w} ${CARABINER_VIEWBOX.h}`}
      width={CARABINER_VIEWBOX.w}
      height={CARABINER_VIEWBOX.h}
      aria-hidden="true"
      focusable="false"
      data-lost-end=""
    >
      <path className="pc-harness" d={HARNESS_STRAP_PATH} />
      <path className="pc-ink" d={HARNESS_RING_PATH} />
      <path className="pc-ink" d={CARABINER_RING_PATH} />
      <path className="pc-ink" d={CARABINER_GATE_PATH} />
      <path className="pc-ink" d={CARABINER_LEASH_PATH} />
    </svg>
  )
}
