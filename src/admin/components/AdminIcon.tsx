import React from 'react'

import type { AdminIconName } from '../views/registry'

// Symbole der Verwaltungs-Navigation (PLAN P5.1): schlichte Strichsymbole, 24 × 24, `currentColor`, rein dekorativ
// (die Beschriftung steht immer daneben). Keine Symbol-Bibliothek, keine Fremd-Requests.

const PATHS: Record<AdminIconName, string> = {
  today: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M9 15l2 2 4-4',
  plus: 'M12 5v14M5 12h14',
  pieces: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  box: 'M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8',
  bank: 'M3 9l9-5 9 5M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 20h18',
  truck:
    'M2 6h11v10H2zM13 10h5l3 3v3h-8M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  store: 'M4 10v10h16V10M3 10l2-6h14l2 6zM10 20v-6h4v6',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  mail: 'M3 5h18v14H3zM3 6l9 7 9-7',
  needle: 'M4 20l3-1 11-11-2-2L5 17zM14 6l4 4M16 4l4 4',
  text: 'M5 5h14M5 10h14M5 15h10M5 20h7',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
  download: 'M12 3v12M7 10l5 5 5-5M4 20h16',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  data: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
}

export function AdminIcon({ name, size = 22 }: { name: AdminIconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === 'more' ? 3 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="pc-admin-icon"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
