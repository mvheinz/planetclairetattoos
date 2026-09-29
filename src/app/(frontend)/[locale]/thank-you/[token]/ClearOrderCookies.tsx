'use client'

import { useEffect } from 'react'

import { CART_CHANGE_EVENT } from '@/behaviors/types'

import { clearOrderCookies } from './actions'

// Löscht nach dem Laden der Danke-Seite (Bestellung vorhanden) einmal `pc_cart` und `pc_checkout` (Server-Action) und
// meldet der Korb-Anzahl im Kopf die Änderung (MI-07 liest `pc_cart` neu). Rendert nichts.
export function ClearOrderCookies({ token }: { token: string }) {
  useEffect(() => {
    let active = true
    void clearOrderCookies(token)
      .then((cleared) => {
        if (active && cleared)
          document.dispatchEvent(new CustomEvent(CART_CHANGE_EVENT, { detail: {} }))
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [token])
  return null
}
