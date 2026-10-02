'use client'

import React, { useEffect, useId, useRef } from 'react'

import { adminText } from '../translations'

// Bestätigungsdialog (PLAN P5.1, KONZEPT §7.1 „Bestätigungen“): nennt die Folge der Aktion (z. B. „Die Kundin bekommt
// eine Versandmail.“). Pflicht für Aktionen, die Mails senden, Geld bewegen, Bestand ändern oder Daten löschen – der
// `ActionButton` erzwingt das über seine Typen. Natives `<dialog>` (Fokusfalle, Escape = Abbrechen), keine Animation.
// Kein `<form>`: der Dialog kann in einem Payload-Formular stehen (verschachtelte Formulare sind ungültig).

export interface ConfirmDialogProps {
  open: boolean
  title: string
  /** Was passiert, wenn bestätigt wird – ein ganzer Satz. */
  consequence: string
  confirmLabel?: string
  cancelLabel?: string
  busy?: boolean
  /** Bestätigen gesperrt (z. B. Pflichtfeld im Dialog leer). */
  confirmDisabled?: boolean
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
  /** Zusätzliche Eingaben (Betrag, Grund …). */
  children?: React.ReactNode
}

export function ConfirmDialog({
  open,
  title,
  consequence,
  confirmLabel = adminText('confirmOk'),
  cancelLabel = adminText('confirmAbort'),
  busy = false,
  confirmDisabled = false,
  danger = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descId = useId()

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
        // Escape: während der Anfrage nicht schließen.
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
          {children}
          <div className="pc-admin-row">
            <button
              type="button"
              className={`pc-admin-btn ${danger ? 'pc-admin-btn--danger' : 'pc-admin-btn--primary'}`}
              onClick={onConfirm}
              disabled={busy || confirmDisabled}
              aria-busy={busy || undefined}
              data-testid="confirm-dialog-ok"
            >
              {busy ? adminText('actionBusy') : confirmLabel}
            </button>
            <button
              type="button"
              className="pc-admin-btn pc-admin-btn--secondary"
              onClick={onCancel}
              disabled={busy}
            >
              {cancelLabel}
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  )
}
