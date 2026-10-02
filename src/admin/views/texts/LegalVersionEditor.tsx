'use client'

import { useRouter } from 'next/navigation'
import React, { useId, useState } from 'react'

import { AdminActionError, postAdminAction } from '../../components/adminAction'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Notice } from '../../components/Notice'
import { adminText } from '../../translations'

// „Neue Version“ eines Rechtstexts oder Bausteins (PLAN P6.4, KONZEPT §7.13): Text DE einfügen (HTML oder Text),
// EN optional, Herkunft wählen, „Vorschau“ (gerendert mit den Platzhaltern, Fehlerliste – speichert nichts) und erst
// danach „Veröffentlichen“ sofort oder ab Datum mit Rückfrage „Ab {Datum} gilt dieser Text für neue Bestellungen.“.
// Jede Änderung an den Eingaben verlangt eine neue Vorschau.

interface Preview {
  errors: string[]
  html: { de?: string; en?: string }
  validFrom: string
  scheduled: boolean
}

export type LegalVersionTarget =
  | { kind: 'text'; type: string; label: string }
  | { kind: 'snippet'; keys: readonly { key: string; label: string }[] }

export interface LegalVersionEditorProps {
  target: LegalVersionTarget
  apiBase: string
  'data-testid'?: string
}

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso))

export function LegalVersionEditor({
  target,
  apiBase,
  'data-testid': testId,
}: LegalVersionEditorProps) {
  const router = useRouter()
  const id = useId()
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState(target.kind === 'snippet' ? (target.keys[0]?.key ?? '') : '')
  const [format, setFormat] = useState<'html' | 'text'>('html')
  const [de, setDe] = useState('')
  const [en, setEn] = useState('')
  const [origin, setOrigin] = useState<'draft' | 'lawyer'>('draft')
  const [sourceNote, setSourceNote] = useState('')
  const [changeNote, setChangeNote] = useState('')
  const [when, setWhen] = useState<'now' | 'date'>('now')
  const [date, setDate] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)

  const collection = target.kind === 'text' ? 'legal-texts' : 'legal-snippets'
  const body = () => ({
    ...(target.kind === 'text'
      ? { type: target.type, format, sourceNote, changeNote }
      : { key, changeNote }),
    de,
    en,
    origin,
    validFrom: when === 'date' ? date : '',
  })
  const changed =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v)
      setPreview(null)
      setDone(null)
    }

  const runPreview = async () => {
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      const res = await postAdminAction<{ preview: Preview }>(
        `${apiBase}/${collection}/preview-version`,
        body(),
      )
      setPreview(res.preview)
    } catch (err) {
      setPreview(null)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const publish = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await postAdminAction<{
        published: { status: string; version: number; validFrom: string }
      }>(`${apiBase}/${collection}/publish-version`, body())
      const p = res.published
      setDone(
        adminText(p.status === 'scheduled' ? 'legalPublishedScheduled' : 'legalPublishedNow', {
          version: p.version,
          date: fmtDate(p.validFrom),
        }),
      )
      setAsking(false)
      setOpen(false)
      setDe('')
      setEn('')
      setPreview(null)
      router.refresh()
    } catch (err) {
      setAsking(false)
      setError(err instanceof AdminActionError || err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const canPublish = preview !== null && preview.errors.length === 0 && !busy
  const title =
    target.kind === 'text'
      ? adminText('legalNewVersionOf', { label: target.label })
      : adminText('legalSnippetNewVersion')

  if (!open) {
    return (
      <div data-testid={testId}>
        {done ? (
          <Notice tone="success" data-testid="legal-published">
            {done}
          </Notice>
        ) : null}
        <p className="pc-admin-row">
          <button
            type="button"
            className="pc-admin-btn pc-admin-btn--secondary"
            onClick={() => setOpen(true)}
            data-testid="legal-new-version"
          >
            {adminText('legalNewVersion')}
          </button>
        </p>
      </div>
    )
  }

  return (
    <div className="pc-settings__form" data-testid={testId} role="group" aria-label={title}>
      <h4 className="pc-order__cardtitle">{title}</h4>
      {target.kind === 'snippet' ? (
        <div className="pc-field">
          <label htmlFor={`${id}-key`} className="pc-field__label">
            {adminText('legalSnippetKey')}
          </label>
          <select
            id={`${id}-key`}
            value={key}
            onChange={(e) => changed(setKey)(e.target.value)}
            data-testid="legal-snippet-key"
          >
            {target.keys.map((k) => (
              <option key={k.key} value={k.key}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <fieldset className="pc-field">
          <legend className="pc-field__label">{adminText('legalFormat')}</legend>
          <label>
            <input
              type="radio"
              name={`${id}-format`}
              checked={format === 'html'}
              onChange={() => changed(setFormat)('html')}
            />{' '}
            {adminText('legalFormatHtml')}
          </label>
          <label>
            <input
              type="radio"
              name={`${id}-format`}
              checked={format === 'text'}
              onChange={() => changed(setFormat)('text')}
            />{' '}
            {adminText('legalFormatText')}
          </label>
        </fieldset>
      )}
      <div className="pc-field">
        <label htmlFor={`${id}-de`} className="pc-field__label">
          {adminText('legalTextDe')} <span className="pc-field__required">*</span>
        </label>
        <textarea
          id={`${id}-de`}
          value={de}
          onChange={(e) => changed(setDe)(e.target.value)}
          rows={8}
          required
          spellCheck={false}
          data-testid="legal-text-de"
        />
      </div>
      <div className="pc-field">
        <label htmlFor={`${id}-en`} className="pc-field__label">
          {adminText('legalTextEn')}
        </label>
        <textarea
          id={`${id}-en`}
          value={en}
          onChange={(e) => changed(setEn)(e.target.value)}
          rows={4}
          spellCheck={false}
          data-testid="legal-text-en"
        />
      </div>
      <div className="pc-field">
        <label htmlFor={`${id}-origin`} className="pc-field__label">
          {adminText('legalOrigin')}
        </label>
        <select
          id={`${id}-origin`}
          value={origin}
          onChange={(e) => changed(setOrigin)(e.target.value as 'draft' | 'lawyer')}
          data-testid="legal-origin"
        >
          <option value="draft">{adminText('legalOriginDraft')}</option>
          <option value="lawyer">{adminText('legalOriginLawyer')}</option>
        </select>
      </div>
      {target.kind === 'text' ? (
        <div className="pc-field">
          <label htmlFor={`${id}-source`} className="pc-field__label">
            {adminText('legalSourceNote')}
          </label>
          <input
            id={`${id}-source`}
            type="text"
            value={sourceNote}
            maxLength={200}
            onChange={(e) => setSourceNote(e.target.value)}
          />
        </div>
      ) : null}
      <div className="pc-field">
        <label htmlFor={`${id}-change`} className="pc-field__label">
          {adminText('legalChangeNote')}
        </label>
        <input
          id={`${id}-change`}
          type="text"
          value={changeNote}
          maxLength={300}
          onChange={(e) => setChangeNote(e.target.value)}
        />
      </div>
      <fieldset className="pc-field">
        <legend className="pc-field__label">{adminText('legalValidFrom')}</legend>
        <label>
          <input
            type="radio"
            name={`${id}-when`}
            checked={when === 'now'}
            onChange={() => changed(setWhen)('now')}
          />{' '}
          {adminText('legalValidNow')}
        </label>
        <label>
          <input
            type="radio"
            name={`${id}-when`}
            checked={when === 'date'}
            onChange={() => changed(setWhen)('date')}
            data-testid="legal-when-date"
          />{' '}
          {adminText('legalValidDate')}
        </label>
        {when === 'date' ? (
          <input
            type="date"
            aria-label={adminText('legalValidDate')}
            value={date}
            onChange={(e) => changed(setDate)(e.target.value)}
            data-testid="legal-date"
          />
        ) : null}
      </fieldset>
      <p className="pc-admin-row">
        <button
          type="button"
          className="pc-admin-btn pc-admin-btn--secondary"
          onClick={() => void runPreview()}
          disabled={busy || !de.trim()}
          aria-busy={busy || undefined}
          data-testid="legal-preview"
        >
          {adminText('legalPreview')}
        </button>
        <button
          type="button"
          className="pc-admin-btn pc-admin-btn--primary"
          onClick={() => setAsking(true)}
          disabled={!canPublish}
          data-testid="legal-publish"
        >
          {adminText('legalPublish')}
        </button>
        <button
          type="button"
          className="pc-admin-btn pc-admin-btn--secondary"
          onClick={() => {
            setOpen(false)
            setPreview(null)
            setError(null)
          }}
          disabled={busy}
        >
          {adminText('confirmAbort')}
        </button>
      </p>
      {!preview && !error ? (
        <p className="pc-order__muted">{adminText('legalPreviewFirst')}</p>
      ) : null}
      {error ? (
        <Notice tone="error" data-testid="legal-error">
          {error}
        </Notice>
      ) : null}
      {preview ? (
        <div data-testid="legal-preview-result">
          {preview.errors.length ? (
            <div
              className="pc-admin-notice pc-admin-notice--error"
              role="alert"
              data-testid="legal-preview-errors"
            >
              <p className="pc-admin-notice__text">{adminText('legalPreviewErrors')}</p>
              <ul>
                {preview.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          ) : (
            <Notice tone="success" data-testid="legal-preview-ok">
              {adminText('legalPreviewOk', { date: fmtDate(preview.validFrom) })}
            </Notice>
          )}
          {(['de', 'en'] as const).map((locale) =>
            preview.html[locale] ? (
              <section
                key={locale}
                className="pc-texts__preview"
                lang={locale}
                aria-label={adminText(locale === 'de' ? 'legalTextDe' : 'legalTextEn')}
                data-testid={`legal-preview-${locale}`}
                // Server-seitig bereinigt (Allowlist KANZLEI-BRIEFING §1.2) und aus Lexical erzeugt.
                dangerouslySetInnerHTML={{ __html: preview.html[locale]! }}
              />
            ) : null,
          )}
        </div>
      ) : null}
      <ConfirmDialog
        open={asking}
        title={adminText('legalPublishTitle')}
        consequence={adminText('legalPublishConsequence', {
          date: preview ? fmtDate(preview.validFrom) : '',
        })}
        confirmLabel={adminText('legalPublish')}
        busy={busy}
        onConfirm={() => void publish()}
        onCancel={() => setAsking(false)}
      />
    </div>
  )
}

/** „Geprüft, keine Änderung“ (R-014). */
export function LegalReviewButton({ type, apiBase }: { type: string; apiBase: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  return (
    <>
      <p className="pc-admin-row">
        <button
          type="button"
          className="pc-admin-btn pc-admin-btn--secondary"
          disabled={busy}
          aria-busy={busy || undefined}
          data-testid="legal-review"
          onClick={async () => {
            setBusy(true)
            setMsg(null)
            try {
              await postAdminAction(`${apiBase}/legal-texts/confirm-review`, { type })
              setMsg({ tone: 'success', text: adminText('legalReviewDone') })
              router.refresh()
            } catch (err) {
              setMsg({ tone: 'error', text: err instanceof Error ? err.message : String(err) })
            } finally {
              setBusy(false)
            }
          }}
        >
          {adminText('legalReview')}
        </button>
      </p>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
    </>
  )
}
