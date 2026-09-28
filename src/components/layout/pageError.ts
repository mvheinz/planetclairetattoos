'use client'

import { useSyncExternalStore } from 'react'

// Fehlerzustand der Seite (R29, DESIGN KO-18): Das Fehler-Boundary `error.tsx` liegt unter dem Layout; Preset am
// `<body>` und Linien-Ebene stehen darüber. Solange die 500-Seite zu sehen ist, meldet sie sich hier an – dann gilt
// kein Preset, die Engine wird abgebaut und nichts bewegt sich („Keine Animation“).

let count = 0
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

/** Meldet die Fehlerseite an; gibt die Abmeldung zurück (für `useEffect`). */
export function enterPageError(): () => void {
  count++
  emit()
  let left = false
  return () => {
    if (left) return
    left = true
    count--
    emit()
  }
}

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** `true`, solange eine Fehlerseite (R29) angezeigt wird. */
export function usePageError(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => count > 0,
    () => false,
  )
}
