'use client'

import React, { createContext, useContext, useSyncExternalStore } from 'react'

import styles from './Commission.module.css'
import type { CommissionImages, ImageStore } from './CommissionImages'
import type { CommissionFormMessages } from './CommissionView'

// Kleine Client-Teile des Formulars Auftragsarbeiten R10, die auch in der vom Server gerenderten Erstansicht stehen
// (CommissionView.tsx). Sie lesen den Zustand aus dem Kontext von `CommissionForm`.

export interface CommissionContextValue {
  locale: 'de' | 'en'
  messages: CommissionFormMessages
  token: string
  pending: boolean
  /** Absenden blockiert, weil noch Bilder hochladen (Hinweis in der Statuszeile). */
  blocked: boolean
  busyImages: boolean
  objectType: string
  setObjectType: (value: string) => void
  /** Bildauswahl, sobald nach dem `load`-Ereignis nachgeladen (vorher `null`). */
  Images: typeof CommissionImages | null
  store: ImageStore
}

export const CommissionContext = createContext<CommissionContextValue | null>(null)

const useCommission = () => {
  const ctx = useContext(CommissionContext)
  if (!ctx) throw new Error('CommissionContext fehlt')
  return ctx
}

const noopSubscribe = () => () => {}

/** Merkt sich die Auswahl „Was soll es werden?“ (für das Feld „Etwas anderes“). */
export function ObjectTypeWatch({ children }: { children: React.ReactNode }) {
  const { setObjectType } = useCommission()
  return (
    <div onChange={(e) => setObjectType((e.target as unknown as HTMLSelectElement).value)}>
      {children}
    </div>
  )
}

/** „Etwas anderes“: ohne JavaScript immer sichtbar, sonst nur bei dieser Auswahl. */
export function OtherFieldGate({ children }: { children: React.ReactNode }) {
  const { objectType } = useCommission()
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )
  return !mounted || objectType === 'sonstiges' ? children : null
}

/** Bildauswahl (nach dem `load`-Ereignis), vorher wie ohne JavaScript der Hinweis „Bilder nur mit JavaScript“. */
export function ImagesSlot({ noJsText }: { noJsText: string }) {
  const { Images, locale, token, messages, store } = useCommission()
  return Images ? (
    <Images locale={locale} token={token} messages={messages} store={store} />
  ) : (
    <p className={styles.small} data-commission-nojs="">
      {noJsText}
    </p>
  )
}

/** Statuszeile: „wird gesendet …“ bzw. „Bilder werden noch hochgeladen“. */
export function CommissionLive() {
  const { pending, blocked, busyImages, messages: m } = useCommission()
  return (
    <p className={styles.live} aria-live="polite">
      {pending ? m.busy : blocked && busyImages ? m.imagesPending : ''}
    </p>
  )
}
