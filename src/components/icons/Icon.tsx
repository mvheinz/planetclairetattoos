import React from 'react'

import { ICON_SHAPES, type IconName } from './icons.generated'

export type { IconName }

// Handgezeichnete Icons als Inline-SVG (DESIGN §6.5): 24er-viewBox, Strich 1.75, runde Enden, `currentColor`.
// Standard ist dekorativ (`aria-hidden`); nur mit `label` (Galerie-Pfeile, Lightbox-Schließen) bekommt das Icon
// `role="img"` und einen zugänglichen Namen. Kein Sprite, kein `<use href>` – das SVG steht direkt im HTML.
export function Icon({
  name,
  label,
  size = 24,
  className,
}: {
  name: IconName
  label?: string
  size?: number | string
  className?: string
}) {
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true as const }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      className={className}
      {...a11y}
    >
      {ICON_SHAPES[name].map(([tag, attrs], i) => React.createElement(tag, { key: i, ...attrs }))}
    </svg>
  )
}
