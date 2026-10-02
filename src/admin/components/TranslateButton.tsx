'use client'

import React, { useRef, useState } from 'react'

import { adminText } from '../translations'
import { AdminActionError, postAdminAction } from './adminAction'
import { ConfirmDialog } from './ConfirmDialog'
import { Notice } from './Notice'

// Knopf „Übersetzen → EN“ (PLAN P5.4, E-61, ARCHITEKTUR §3.6): ruft einen Übersetzen-Endpunkt (`POST …/translate`,
// Rumpf `{ force }`) auf und meldet das Ergebnis als Text. Leere englische Felder werden immer gefüllt; gibt es schon
// englische Texte, fragt ein Dialog, ob sie überschrieben werden sollen („Nur leere Felder“ oder „Alles
// überschreiben“ = `force`). In Produktion ohne DeepL ist der Knopf gesperrt mit Hinweis („Übersetzen ist noch nicht
// eingerichtet“). Allgemein gehalten – P7 nutzt ihn für Flash, Angebote, Tattoo-Seiten und FAQ.

export interface TranslateButtonProps<T = Record<string, unknown>> {
  /** Endpunkt, z. B. `/api/products/17/translate`; `null` = Dokument noch nicht gespeichert. */
  endpoint: string | null
  /** Gibt es schon englische Texte? Dann Rückfrage vor dem Überschreiben. */
  hasEnglish: boolean
  /** Gesperrt mit Hinweis (z. B. „Übersetzen ist noch nicht eingerichtet“). */
  disabledReason?: string | null
  /** Vorher speichern (liefert den Endpunkt, falls er erst dabei entsteht); `null` = abbrechen. */
  prepare?: () => Promise<string | null>
  /** Ergebnis des Endpunkts (`{ doc }`). */
  onTranslated?: (result: T) => void | Promise<void>
  label?: string
  disabled?: boolean
}

type Feedback = { tone: 'success' | 'error'; text: string } | null

export function TranslateButton<T = Record<string, unknown>>({
  endpoint,
  hasEnglish,
  disabledReason,
  prepare,
  onTranslated,
  label = adminText('translateLabel'),
  disabled = false,
}: TranslateButtonProps<T>) {
  const running = useRef(false)
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const hintId = React.useId()

  const run = async (force: boolean) => {
    if (running.current) return
    running.current = true
    setBusy(true)
    setFeedback(null)
    try {
      const url = prepare ? await prepare() : endpoint
      if (!url) return
      const result = await postAdminAction(url, { force })
      await onTranslated?.(result as unknown as T)
      setFeedback({ tone: 'success', text: adminText('translateDone') })
    } catch (err) {
      setFeedback({
        tone: 'error',
        text:
          err instanceof AdminActionError
            ? err.message
            : adminText('actionFailed', { message: (err as Error)?.message ?? String(err) }),
      })
    } finally {
      running.current = false
      setBusy(false)
      setAsking(false)
    }
  }

  const locked = disabled || busy || !!disabledReason
  return (
    <span className="pc-admin-action">
      <button
        type="button"
        className="pc-admin-btn pc-admin-btn--secondary"
        disabled={locked}
        aria-busy={busy || undefined}
        aria-describedby={disabledReason ? hintId : undefined}
        data-testid="translate-button"
        onClick={() => {
          if (running.current) return
          if (hasEnglish) setAsking(true)
          else void run(false)
        }}
      >
        {busy ? adminText('translateBusy') : label}
      </button>
      {disabledReason ? (
        <span id={hintId} className="pc-piece__hint">
          {disabledReason}
        </span>
      ) : null}
      <ConfirmDialog
        open={asking}
        title={adminText('translateAskTitle')}
        consequence={adminText('translateAskText')}
        confirmLabel={adminText('translateOnlyEmpty')}
        cancelLabel={adminText('confirmAbort')}
        busy={busy}
        onConfirm={() => void run(false)}
        onCancel={() => setAsking(false)}
      >
        <p className="pc-admin-row">
          <button
            type="button"
            className="pc-admin-btn pc-admin-btn--danger"
            disabled={busy}
            data-testid="translate-force"
            onClick={() => void run(true)}
          >
            {adminText('translateForce')}
          </button>
        </p>
      </ConfirmDialog>
      {feedback ? <Notice tone={feedback.tone}>{feedback.text}</Notice> : null}
    </span>
  )
}
