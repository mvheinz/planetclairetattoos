'use client'

import React from 'react'

import { HAND_LINE_HEIGHT, HAND_LINE_LENGTH, HEADER_LINE_PATHS } from '@/art/handLine'
import { variantOf } from '@/lib/stringHash'

import { useCurrentRoute } from './useCurrentRoute'

// Unterkante der Kopfleiste (DESIGN KO-02): statische Handlinie, 2400 px lang, links verankert und rechts
// abgeschnitten, `--ink` 1.5 px; drei Varianten nach Routen-Seed. Leinen-Anschluss der Tuschelinie (§9.8).
export function HeaderLine({ className }: { className?: string }) {
  const routeId = useCurrentRoute()?.route.id ?? 'R28'
  const variant = variantOf(routeId, HEADER_LINE_PATHS.length)
  return (
    <svg
      className={className}
      width={HAND_LINE_LENGTH}
      height={HAND_LINE_HEIGHT}
      viewBox={`0 0 ${HAND_LINE_LENGTH} ${HAND_LINE_HEIGHT}`}
      aria-hidden="true"
      focusable="false"
      data-header-line={variant}
    >
      <path d={HEADER_LINE_PATHS[variant]} />
    </svg>
  )
}
