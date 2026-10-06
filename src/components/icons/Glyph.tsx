import React from 'react'

// Handgezeichnete Icons als Inline-SVG (DESIGN §6.5): 24er-viewBox, Strich 1.75, runde Enden, `currentColor` (Darstellung einmal in `global.css` `:where(.glyph)` statt je Icon im DOM, PF-10).
// Standard ist dekorativ (`aria-hidden`); nur mit `label` (Galerie-Pfeile, Lightbox-Schließen) bekommt das Icon
// `role="img"` und einen zugänglichen Namen. Kein Sprite, kein `<use href>` – das SVG steht direkt im HTML.
// `Glyph` bekommt die Formen direkt (z. B. `ICON_WARN`) und zieht so in Client-Komponenten nicht die ganze Icon-Tabelle
// in den Client-Chunk (Budget firstLoadJs, tests/perf/budgets.json); `Icon` (Name → Formen) ist für Server-Komponenten.

export type IconShapes = readonly (readonly [string, Readonly<Record<string, string>>])[]

export function Glyph({
  shape,
  label,
  size = 24,
  className,
}: {
  shape: IconShapes
  label?: string
  size?: number | string
  className?: string
}) {
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true as const }
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className ? `glyph ${className}` : 'glyph'}
      {...a11y}
    >
      {shape.map(([tag, attrs], i) => React.createElement(tag, { key: i, ...attrs }))}
    </svg>
  )
}
