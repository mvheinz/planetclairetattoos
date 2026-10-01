'use client'

import { useRouter } from 'next/navigation'
import React, { useId, useRef, useState } from 'react'

import { adminText } from '../translations'
import { AdminActionError, postAdminAction } from './adminAction'
import { Notice } from './Notice'

// Interne Notizen separat speichern (PLAN P5.19/P5.20): Textfeld mit eigenem „Notiz speichern“, unabhängig von den
// übrigen (teils unveränderlichen) Angaben. Endpunkt `POST <url>` `{ adminNotes }`.

export interface NotesEditorProps {
  url: string
  initial: string
  maxLength: number
  label?: string
  hint?: string
}

export function NotesEditor({ url, initial, maxLength, label, hint }: NotesEditorProps) {
  const router = useRouter()
  const [text, setText] = useState(initial)
  const [saved, setSaved] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const running = useRef(false)
  const fieldId = useId()
  const hintId = useId()

  const save = async () => {
    if (running.current) return
    running.current = true
    setBusy(true)
    setFeedback(null)
    try {
      const res = await postAdminAction(url, { adminNotes: text })
      setSaved(text.trim())
      setFeedback({
        tone: 'success',
        text: adminText(res.unchanged ? 'actionUnchanged' : 'notesSaved'),
      })
      router.refresh()
    } catch (err) {
      setFeedback({
        tone: 'error',
        text: err instanceof AdminActionError ? err.message : (err as Error).message,
      })
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  return (
    <div className="pc-field" data-testid="notes-editor">
      <label htmlFor={fieldId} className="pc-field__label">
        {label ?? adminText('notesLabel')}
      </label>
      <textarea
        id={fieldId}
        rows={5}
        maxLength={maxLength}
        value={text}
        aria-describedby={hintId}
        onChange={(e) => setText(e.target.value)}
        data-testid="notes-text"
      />
      <p id={hintId} className="pc-order__muted">
        {hint ?? adminText('notesHint')} ({text.length}/{maxLength})
      </p>
      <p className="pc-admin-row">
        <button
          type="button"
          className="pc-admin-btn pc-admin-btn--secondary"
          disabled={busy || text.trim() === saved.trim()}
          aria-busy={busy || undefined}
          onClick={() => void save()}
          data-testid="notes-save"
        >
          {busy ? adminText('actionBusy') : adminText('notesSave')}
        </button>
      </p>
      {feedback ? <Notice tone={feedback.tone}>{feedback.text}</Notice> : null}
    </div>
  )
}
