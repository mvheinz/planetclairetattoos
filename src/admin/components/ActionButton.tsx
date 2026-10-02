'use client'

import React, { useRef, useState } from 'react'

import { adminText } from '../translations'
import type { AdminActionOutcome } from './adminAction'
import { ConfirmDialog } from './ConfirmDialog'
import { Notice } from './Notice'

// Aktionsknopf der Verwaltung (PLAN P5.1, KONZEPT §7.1): mindestens 44 px hoch, gesperrt, solange die Anfrage läuft –
// ein Doppeltipp löst genau eine Anfrage aus (Sperre über eine Ref, greift schon vor dem nächsten Rendern). Aktionen
// mit Wirkung nach außen (Mail, Geld, Bestand, Löschen) brauchen einen Bestätigungsdialog, der die Folge nennt; das
// erzwingen die Typen (`effects` ⇒ `confirm`). Ergebnis als Text (`Notice`), Fehler mit Handlungsvorschlag.

export type ActionEffect = 'mail' | 'money' | 'stock' | 'delete'

export interface ConfirmSpec {
  title: string
  /** Folge der Aktion als ganzer Satz, z. B. „Die Kundin bekommt eine Versandmail.“ */
  consequence: string
  confirmLabel?: string
}

interface BaseProps {
  children: React.ReactNode
  action: () => Promise<AdminActionOutcome | void>
  onDone?: (outcome: AdminActionOutcome) => void
  variant?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
  'data-testid'?: string
}

export type ActionButtonProps = BaseProps &
  (
    | { effects?: undefined; confirm?: ConfirmSpec }
    | { effects: readonly [ActionEffect, ...ActionEffect[]]; confirm: ConfirmSpec }
  )

type Feedback = { tone: 'success' | 'error'; text: string } | null

export function ActionButton({
  children,
  action,
  onDone,
  variant = 'primary',
  disabled = false,
  confirm,
  'data-testid': testId,
}: ActionButtonProps) {
  const running = useRef(false)
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)

  const run = async () => {
    if (running.current) return
    running.current = true
    setBusy(true)
    setFeedback(null)
    try {
      const outcome = (await action()) ?? {}
      setFeedback({
        tone: 'success',
        text: outcome.message ?? adminText(outcome.unchanged ? 'actionUnchanged' : 'actionDone'),
      })
      setAsking(false)
      onDone?.(outcome)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setFeedback({
        tone: 'error',
        text:
          err instanceof Error && err.name === 'AdminActionError'
            ? message
            : adminText('actionFailed', { message }),
      })
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  return (
    <span className="pc-admin-action">
      <button
        type="button"
        className={`pc-admin-btn pc-admin-btn--${variant}`}
        disabled={disabled || busy}
        aria-busy={busy || undefined}
        data-testid={testId}
        onClick={() => {
          if (running.current) return
          if (confirm) setAsking(true)
          else void run()
        }}
      >
        {busy && !confirm ? adminText('actionBusy') : children}
      </button>
      {confirm ? (
        <ConfirmDialog
          open={asking}
          title={confirm.title}
          consequence={confirm.consequence}
          confirmLabel={confirm.confirmLabel}
          danger={variant === 'danger'}
          busy={busy}
          onConfirm={() => void run()}
          onCancel={() => setAsking(false)}
        >
          {feedback?.tone === 'error' ? <Notice tone="error">{feedback.text}</Notice> : null}
        </ConfirmDialog>
      ) : null}
      {feedback && !(confirm && asking) ? (
        <Notice tone={feedback.tone}>{feedback.text}</Notice>
      ) : null}
    </span>
  )
}
