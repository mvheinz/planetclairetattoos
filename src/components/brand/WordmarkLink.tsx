import React from 'react'

// Wortmarke „planet claire“ als Link zur Startseite (DESIGN §12.6, KO-01). Das Bild kommt vom eigenen Origin
// (`public/art/wordmark.svg`); der zugängliche Name des Links ist der Alternativtext („planet claire – Startseite“,
// i18n-Schlüssel `header.home`). Höhe über `--fs-wordmark` (DESIGN §4.2).
export const WORDMARK_SRC = '/art/wordmark.svg'
/** Seitenverhältnis der Wortmarke (viewBox-Breite / -Höhe), damit der Platz vor dem Laden reserviert ist (CLS). */
export const WORDMARK_WIDTH = 423
export const WORDMARK_HEIGHT = 107

export function WordmarkLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="wordmark-link">
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG vom eigenen Origin, kein Bild-Optimierer nötig */}
      <img
        src={WORDMARK_SRC}
        alt={label}
        width={WORDMARK_WIDTH}
        height={WORDMARK_HEIGHT}
        className="wordmark-link__img"
      />
    </a>
  )
}
