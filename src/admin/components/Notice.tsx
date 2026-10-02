import React from 'react'

// Rückmeldung in der Verwaltung (PLAN P5.1, KONZEPT §7.1 „Rückmeldung“): Erfolg oder Fehler als Text, Fehler mit
// Handlungsvorschlag. `aria-live` sagt die Meldung an (Fehler sofort, sonst höflich); keine Animation (DESIGN §3.3).

export type NoticeTone = 'success' | 'error' | 'warning' | 'info'

export interface NoticeProps {
  tone: NoticeTone
  children: React.ReactNode
  /** Handlungsvorschlag als Link (z. B. „In „Alle Daten“ öffnen“). */
  action?: { href: string; label: string }
  id?: string
  'data-testid'?: string
}

export function Notice({ tone, children, action, id, 'data-testid': testId }: NoticeProps) {
  const urgent = tone === 'error'
  return (
    <div
      id={id}
      role={urgent ? 'alert' : 'status'}
      aria-live={urgent ? 'assertive' : 'polite'}
      className={`pc-admin-notice pc-admin-notice--${tone}`}
      data-testid={testId}
    >
      <p className="pc-admin-notice__text">{children}</p>
      {action ? (
        <p className="pc-admin-notice__action">
          <a href={action.href} className="pc-admin-link">
            {action.label}
          </a>
        </p>
      ) : null}
    </div>
  )
}
