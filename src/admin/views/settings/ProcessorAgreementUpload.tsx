'use client'

import { useRouter } from 'next/navigation'
import React, { useId, useRef, useState } from 'react'

import { Notice } from '../../components/Notice'
import { adminText } from '../../translations'
import { looksLikePdf } from './ComplianceUpload'
import { areaText } from './settingsAreas'

// AVV-PDF hochladen (PLAN P6.21, DATENMODELL §7.1 `processorAgreements[].file`, DM-40): Ablage privat in
// `private-uploads` mit Zweck `processor_agreement` (keine automatische Löschung, L-25); danach im Formular
// „Auftragsverarbeitung“ beim Dienst auswählen. Nur PDF (Kennung `%PDF-`).

export function ProcessorAgreementUpload() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const fileId = useId()
  const titleId = useId()
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const submit = async () => {
    const file = fileRef.current?.files?.[0]
    setFeedback(null)
    if (!file) return setFeedback({ tone: 'error', text: adminText('safetyNoFile') })
    if (!(await looksLikePdf(file))) {
      return setFeedback({ tone: 'error', text: adminText('safetyPdfOnly') })
    }
    setBusy(true)
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('_payload', JSON.stringify({ purpose: 'processor_agreement' }))
      const res = await fetch('/api/private-uploads?depth=0', {
        method: 'POST',
        credentials: 'include',
        body,
      })
      const json = (await res.json().catch(() => ({}))) as {
        doc?: { id: number }
        errors?: { message?: string; data?: { errors?: { message?: string }[] } }[]
      }
      if (!res.ok || !json.doc) {
        const first = json.errors?.[0]
        throw new Error(first?.data?.errors?.[0]?.message ?? first?.message ?? res.statusText)
      }
      setFeedback({ tone: 'success', text: adminText('safetyUploaded') })
      if (fileRef.current) fileRef.current.value = ''
      router.refresh()
    } catch (err) {
      setFeedback({
        tone: 'error',
        text: adminText('actionFailed', { message: (err as Error).message }),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pc-settings__group" aria-labelledby={titleId} role="group">
      <h4 id={titleId}>{areaText('avvUploadTitle')}</h4>
      <div className="pc-field">
        <label htmlFor={fileId} className="pc-field__label">
          {adminText('safetyFile')}
        </label>
        <input
          id={fileId}
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          aria-describedby={`${fileId}-hint`}
          data-testid="avv-upload-file"
        />
        <p id={`${fileId}-hint`} className="pc-order__muted">
          {areaText('avvUploadHint')}
        </p>
      </div>
      <p className="pc-admin-row">
        <button
          type="button"
          className="pc-admin-btn pc-admin-btn--secondary"
          disabled={busy}
          aria-busy={busy || undefined}
          onClick={() => void submit()}
          data-testid="avv-upload-submit"
        >
          {busy ? adminText('actionBusy') : adminText('safetyUploadButton')}
        </button>
      </p>
      {feedback ? (
        <div role="status">
          <Notice tone={feedback.tone}>{feedback.text}</Notice>
        </div>
      ) : null}
    </div>
  )
}
