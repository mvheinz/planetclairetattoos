'use client'

import React, { createContext, useContext } from 'react'

import styles from './WithdrawalFlow.module.css'

// Kleine Client-Teile der Widerrufsfunktion R26, die auch in der vom Server gerenderten Erstansicht stehen
// (WithdrawalView.tsx): die Statuszeile „wird gesendet …“ liest `pending` aus dem Kontext von `WithdrawalFlow`.

export const WithdrawalPendingContext = createContext(false)

export function WithdrawalLive({ text }: { text: string }) {
  const pending = useContext(WithdrawalPendingContext)
  return (
    <p className={styles.live} aria-live="polite">
      {pending ? text : ''}
    </p>
  )
}
