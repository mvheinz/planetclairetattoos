import React from 'react'

// Status-Kennzeichen (PLAN P5.1): Text plus Farbe aus den Payload-Variablen `--theme-*` (DESIGN §3.3). Die Bedeutung
// steckt immer im Text, die Farbe ist nur Zusatz (WCAG 1.4.1).

export type StatusTone = 'neutral' | 'success' | 'warning' | 'error' | 'info'

export function StatusBadge({
  tone = 'neutral',
  children,
}: {
  tone?: StatusTone
  children: React.ReactNode
}) {
  return <span className={`pc-admin-badge pc-admin-badge--${tone}`}>{children}</span>
}
