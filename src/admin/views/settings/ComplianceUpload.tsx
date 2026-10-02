'use client'

import { useRouter } from 'next/navigation'
import React, { useId, useRef, useState } from 'react'

import { Notice } from '../../components/Notice'
import { adminText } from '../../translations'

// Hochladen einer Produktsicherheits-Unterlage (PLAN P5.13): Zweck, Kategorie (bei technischen Unterlagen Pflicht),
// Version, Datum, Notiz; nur PDF – die Datei wird vor dem Hochladen an der Kennung `%PDF-` erkannt (ARCHITEKTUR §8.8),
// der Server prüft dasselbe noch einmal. Ablage privat in `private-uploads`, keine automatische Löschung.

const PURPOSES = ['technical_file', 'supplier_document', 'lab_report', 'nickel_evidence'] as const
type Purpose = (typeof PURPOSES)[number]

const PURPOSE_KEY = {
  technical_file: 'safetyPurposeTechnical',
  supplier_document: 'safetyPurposeSupplier',
  lab_report: 'safetyPurposeLab',
  nickel_evidence: 'safetyPurposeNickel',
} as const satisfies Record<Purpose, Parameters<typeof adminText>[0]>

export async function looksLikePdf(file: Blob): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer())
  return String.fromCharCode(...head) === '%PDF-'
}

export function ComplianceUpload({
  categories,
}: {
  categories: { value: string; label: string }[]
}) {
  const router = useRouter()
  const [purpose, setPurpose] = useState<Purpose>('technical_file')
  const [category, setCategory] = useState('')
  const [version, setVersion] = useState('')
  const [docDate, setDocDate] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const ids = { purpose: useId(), category: useId(), version: useId(), date: useId() }
  const noteId = useId()
  const fileId = useId()

  const submit = async () => {
    const file = fileRef.current?.files?.[0]
    setFeedback(null)
    if (!file) return setFeedback({ tone: 'error', text: adminText('safetyNoFile') })
    if (purpose === 'technical_file' && !category) {
      return setFeedback({ tone: 'error', text: adminText('safetyCategoryRequired') })
    }
    if (!(await looksLikePdf(file))) {
      return setFeedback({ tone: 'error', text: adminText('safetyPdfOnly') })
    }
    setBusy(true)
    try {
      const body = new FormData()
      body.append('file', file)
      body.append(
        '_payload',
        JSON.stringify({
          purpose,
          ...(category ? { complianceCategory: category } : {}),
          ...(version.trim() ? { documentVersion: version.trim() } : {}),
          ...(docDate ? { documentDate: new Date(`${docDate}T12:00:00`).toISOString() } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      )
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
      setVersion('')
      setDocDate('')
      setNote('')
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
    <section
      className="pc-order__section"
      aria-labelledby="safety-upload"
      data-testid="compliance-upload"
    >
      <h2 id="safety-upload">{adminText('safetyUpload')}</h2>
      <div className="pc-field">
        <label htmlFor={ids.purpose} className="pc-field__label">
          {adminText('safetyPurpose')}
        </label>
        <select
          id={ids.purpose}
          value={purpose}
          onChange={(e) => setPurpose(e.target.value as Purpose)}
        >
          {PURPOSES.map((p) => (
            <option key={p} value={p}>
              {adminText(PURPOSE_KEY[p])}
            </option>
          ))}
        </select>
      </div>
      <div className="pc-field">
        <label htmlFor={ids.category} className="pc-field__label">
          {adminText('safetyCategory')}
          {purpose === 'technical_file' ? ' *' : ''}
        </label>
        <select id={ids.category} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">{adminText('safetyCategoryNone')}</option>
          {categories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="pc-field">
        <label htmlFor={ids.version} className="pc-field__label">
          {adminText('safetyVersion')}
        </label>
        <input
          id={ids.version}
          type="text"
          maxLength={40}
          value={version}
          onChange={(e) => setVersion(e.target.value)}
        />
      </div>
      <div className="pc-field">
        <label htmlFor={ids.date} className="pc-field__label">
          {adminText('safetyDate')}
        </label>
        <input
          id={ids.date}
          type="date"
          value={docDate}
          onChange={(e) => setDocDate(e.target.value)}
        />
      </div>
      <div className="pc-field">
        <label htmlFor={noteId} className="pc-field__label">
          {adminText('safetyNote')}
        </label>
        <textarea
          id={noteId}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <div className="pc-field">
        <label htmlFor={fileId} className="pc-field__label">
          {adminText('safetyFile')}
        </label>
        <input id={fileId} ref={fileRef} type="file" accept="application/pdf,.pdf" />
      </div>
      <p className="pc-admin-row">
        <button
          type="button"
          className="pc-admin-btn pc-admin-btn--primary"
          disabled={busy}
          aria-busy={busy || undefined}
          onClick={() => void submit()}
          data-testid="compliance-upload-submit"
        >
          {busy ? adminText('actionBusy') : adminText('safetyUploadButton')}
        </button>
      </p>
      {feedback ? (
        <div role="status">
          <Notice tone={feedback.tone}>{feedback.text}</Notice>
        </div>
      ) : null}
    </section>
  )
}
