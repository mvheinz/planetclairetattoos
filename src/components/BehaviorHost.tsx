'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

import { addToCart } from '@/app/(frontend)/[locale]/shop/[product]/actions'
import { mountBehaviors } from '@/behaviors'
import type { BehaviorActions } from '@/behaviors/types'
import { fetchFitnessData } from '@/lib/shop/fitnessDataClient'
import { fetchProductStates } from '@/lib/shop/productStatusClient'
import { fetchThanksState } from '@/lib/shop/thanksStateClient'

// Bindet die Verhaltensmodule (`[data-behavior]` in Kopf, Inhalt und Fuß) im Browser und löst sie bei Routenwechsel
// und Unmount wieder (DESIGN §9.12, ARCHITEKTUR §14.6). Lädt nur die Module, die die Seite braucht (`import()`).
// Server-Aufrufe reicht es als `ctx.actions` herein (die Module bleiben framework-frei und ohne Netzcode, AK-A-2-03).
const ACTIONS: BehaviorActions = {
  addToCart,
  productStatus: fetchProductStates,
  thanksState: fetchThanksState,
  fitnessData: fetchFitnessData,
}

export function BehaviorHost() {
  const pathname = usePathname()
  useEffect(() => {
    const mounted = mountBehaviors(document, { mode: 'app', actions: ACTIONS })
    const root = document.documentElement
    let active = true
    // Alle Module gebunden (erst nach `load`): Marker für Tests und Messskripte (`check:bundle`), sonst ohne Wirkung.
    void mounted.ready.then(() => {
      if (active) root.setAttribute('data-behaviors-ready', '')
    })
    return () => {
      active = false
      root.removeAttribute('data-behaviors-ready')
      mounted.unmount()
    }
  }, [pathname])
  return null
}
