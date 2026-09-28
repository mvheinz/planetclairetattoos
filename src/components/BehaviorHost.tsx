'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

import { mountBehaviors } from '@/behaviors'

// Bindet die Verhaltensmodule (`[data-behavior]` in Kopf, Inhalt und Fuß) im Browser und löst sie bei Routenwechsel
// und Unmount wieder (DESIGN §9.12, ARCHITEKTUR §14.6). Lädt nur die Module, die die Seite braucht (`import()`).
export function BehaviorHost() {
  const pathname = usePathname()
  useEffect(() => {
    const mounted = mountBehaviors(document, { mode: 'app' })
    return () => mounted.unmount()
  }, [pathname])
  return null
}
