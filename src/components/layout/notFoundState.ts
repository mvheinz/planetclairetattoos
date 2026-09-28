'use client'

import { useEffect, useSyncExternalStore } from 'react'

// 404 innerhalb einer Registry-Route (R28, DESIGN KO-18): `notFound()` einer Seite (z. B. R04 unbekannte Nummer, Variante
// „Zuhause“) rendert die 404 unter dem Layout; Preset am `<body>` und Linien-Ebene stehen darüber und sähen sonst die
// Route der Adresse (R04 → `product`). Solange ein 404-Inhalt steht, meldet er sich hier an – dann gilt „keine
// Registry-Route“ (R28, Preset `lost`), wie im `global-not-found`-Dokument.

let count = 0
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function enter(): () => void {
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

/** `true`, solange ein 404-Inhalt angezeigt wird. */
export function useNotFoundShown(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => count > 0,
    () => false,
  )
}

/** Im 404-Inhalt: meldet ihn für die Dauer der Anzeige an (ohne eigenes Markup). */
export function NotFoundMarker() {
  useEffect(() => enter(), [])
  return null
}
