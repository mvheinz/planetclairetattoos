import React from 'react'

// Weltraum-Marken der Startseite (DESIGN §12.5, §12.6): Planet mit Ring (Planet-Marke, Grundlage `src/art/planet.svg`)
// und schiefer 5-zackiger Stern, Tusche von Hand, `aria-hidden`. Farbe über `currentColor` (`--ink`), Planetenkörper
// in `--paper`. Größe setzt der Aufrufer (CSS).

export function PlanetMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      data-mark="planet"
    >
      <path transform="rotate(-18 32 32)" d="M4.5 32.6A27.6 7.4 0 0 1 59.6 31.4" />
      <path
        style={{ fill: 'var(--paper)' }}
        d="M47.4 30.6Q48.1 37 43.8 41.7 39.6 46.4 33.3 47.1 27.1 47.9 22.1 43.9 17 39.9 16.7 33.5 16.4 27.2 20.3 22.2 24.2 17.2 30.5 16.9 36.8 16.6 41.7 20.4 46.7 24.3 47.4 30.6Z"
      />
      <path strokeWidth={1.8} d="M35.6 21.2Q41 22.6 43.6 27.6M39.8 19.8Q44 21.6 45.6 25" />
      <path transform="rotate(-18 32 32)" d="M59.6 31.4A28.2 8 0 0 1 4.3 32.2" />
    </svg>
  )
}

export function StarMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      data-mark="star"
    >
      <path d="M12.4 2.6 14.6 9.1 21.3 9.4 16 13.6 17.9 20.4 12.1 16.5 6.2 20.1 8.3 13.4 2.9 9.6 9.7 9.2Z" />
    </svg>
  )
}
