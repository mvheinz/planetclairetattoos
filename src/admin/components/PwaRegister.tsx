'use client'

import { useConfig } from '@payloadcms/ui'
import { useEffect } from 'react'

import { pwaPaths } from '../pwa/manifest'

// Registrierung des Service Workers – nur in der Verwaltung (`admin.components.header`, PLAN P5.29, KONZEPT §7.1).
// Öffentliche Seiten registrieren nie einen Service Worker (R-130). Ohne Unterstützung oder bei Fehlern: nichts tun.

export function PwaRegister() {
  const {
    config: {
      routes: { admin: adminRoute },
    },
  } = useConfig()
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const p = pwaPaths(adminRoute)
    navigator.serviceWorker.register(p.serviceWorker, { scope: p.scope }).catch(() => undefined)
  }, [adminRoute])
  return null
}
