'use client'

import React, { useEffect, useId, useRef } from 'react'

import { adminText } from '../translations'

// Rückfrage mit mehreren Antworten (V-34, P20.6): wie der Bestätigungsdialog (`ConfirmDialog`: natives `<dialog>`,
// Fokusfalle, Escape = Abbrechen, keine Animation, kein `<form>`), aber mit zwei oder mehr gleichwertigen Antworten –
// z. B. „Kommt es wieder?“ → „Ja, später wieder anbieten“ / „Nein, weglegen“. Jede Antwort nennt ihre Folge.

export interface DialogChoice<K extends string> {
  key: K
  label: string
  /** Folge dieser Antwort als ganzer Satz (steht unter dem Knopf). */
  hint: string
  variant?: 'primary' | 'secondary'
  'data-testid'?: string
}

export interface ChoiceDialogProps<K extends string> {
  open: boolean
  title: string
  consequence: string
  choices: readonly DialogChoice<K>[]
  busy?: boolean
  onChoose: (key: K) => void
  onCancel: () => void
  cancelLabel?: string
  children?: React.ReactNode
}

export function ChoiceDialog<K extends string>({
  open,
  title,
  consequence,
  choices,
  busy = false,
  onChoose,
  onCancel,
  cancelLabel = adminText('confirmAbort'),
  children,
}: ChoiceDialogProps<K>) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descId = useId()
  const hintBase = useId()

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal()
      else d.setAttribute('open', '')
    }
    if (!open && d.open) {
      if (typeof d.close === 'function') d.close()
      else d.removeAttribute('open')
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      className="pc-admin-dialog"
      aria-labelledby={titleId}
      aria-describedby={descId}
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) onCancel()
      }}
    >
      {open ? (
        <div className="pc-admin-dialog__body">
          <h2 id={titleId} className="pc-admin-dialog__title">
            {title}
          </h2>
          <p id={descId} className="pc-admin-dialog__consequence">
            {consequence}
          </p>
          <ul className="pc-admin-choices">
            {choices.map((c, i) => (
              <li key={c.key} className="pc-admin-choices__item">
                <button
                  type="button"
                  className={`pc-admin-btn pc-admin-btn--${c.variant ?? 'secondary'}`}
                  onClick={() => onChoose(c.key)}
                  disabled={busy}
                  aria-busy={busy || undefined}
                  aria-describedby={`${hintBase}-${i}`}
                  data-testid={c['data-testid']}
                >
                  {c.label}
                </button>
                <p id={`${hintBase}-${i}`} className="pc-admin-choices__hint">
                  {c.hint}
                </p>
              </li>
            ))}
          </ul>
          {children}
          <div className="pc-admin-row">
            <button
              type="button"
              className="pc-admin-btn pc-admin-btn--secondary"
              onClick={onCancel}
              disabled={busy}
              data-testid="choice-dialog-cancel"
            >
              {busy ? adminText('actionBusy') : cancelLabel}
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  )
}
