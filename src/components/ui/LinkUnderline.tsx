import React from 'react'

import { variantOf } from '@/lib/stringHash'

import styles from './LinkUnderline.module.css'

// Gezeichnete Unterstreichung (DESIGN KO-03, MI-06): Inline-SVG mit drei handgezeichneten Pfadvarianten, Wahl per Hash
// des Seeds (in Navigationen das `href`). 100 % Linkbreite + 8 px Überstand, Strich `--stroke-ink` in `--ink`.
// Unsichtbar, bis der umgebende Link/Knopf (`data-underline-host`) gehovert (feiner Zeiger), fokussiert oder gedrückt
// wird; dann zeichnet sie sich (reines CSS). Bei `aria-current` statisch gezeichnet. Dekorativ (`aria-hidden`).
export const UNDERLINE_PATHS = [
  'M1 5.2C18 3.6 34 6.2 52 4.6S86 3.4 99 5.4',
  'M1 4.2C22 6.1 41 3.2 60 4.8S88 6.1 99 3.9',
  'M1 5.8C15 4.3 30 5 47 3.9C66 2.8 83 5.7 99 4.5',
] as const

export function LinkUnderline({ seed, className }: { seed: string; className?: string }) {
  const d = UNDERLINE_PATHS[variantOf(seed, UNDERLINE_PATHS.length)]
  return (
    <svg
      className={className ? `${styles.underline} ${className}` : styles.underline}
      viewBox="0 0 100 8"
      preserveAspectRatio="none"
      aria-hidden="true"
      data-ink-underline=""
    >
      <path d={d} pathLength={1} />
    </svg>
  )
}
