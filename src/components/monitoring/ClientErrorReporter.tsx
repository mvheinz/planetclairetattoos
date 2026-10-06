'use client'

import { useEffect } from 'react'

// Browserfehler melden (ARCHITEKTUR §2.5, M-02, R-133): nur eingebunden, wenn `ClientErrorSlot` es erlaubt. Stichprobe
// 10 % je Seitenaufruf, höchstens eine Meldung je Seitenaufruf, nur Meldung/Stack/Pfad an die eigene Adresse, ohne Cookies.
const SAMPLE_RATE = 0.1

export function ClientErrorReporter() {
  useEffect(() => {
    if (Math.random() >= SAMPLE_RATE) return
    let sent = false
    const send = (message: string, stack?: string) => {
      if (sent) return
      sent = true
      try {
        void fetch('/api/client-errors', {
          method: 'POST',
          credentials: 'omit',
          keepalive: true,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            message: message.slice(0, 500),
            stack: stack?.slice(0, 2000),
            path: window.location.pathname.slice(0, 300),
          }),
        }).catch(() => undefined)
      } catch {
        // Melden darf nie stören.
      }
    }
    const onError = (e: ErrorEvent) => send(e.message || 'error', e.error?.stack)
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason as { message?: string; stack?: string } | undefined
      send(r?.message ?? 'unhandledrejection', r?.stack)
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])
  return null
}
