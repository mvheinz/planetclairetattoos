'use client'

import { useRouter } from 'next/navigation'
import React, { useId, useRef, useState } from 'react'

import { AdminActionError, postAdminAction } from '../../components/adminAction'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Notice } from '../../components/Notice'
import { adminText } from '../../translations'
import { tattooText } from './tattooText'

// „Einwilligung widerrufen“ am Galerie-Foto (PLAN P7.8, R-172, R-152, LOESCHKONZEPT §5.10): Dialog nennt die Folgen
// (sofort offline, Bilder gesperrt, Dateien nach 24 h gelöscht, Nachweis 3 Jahre); optional eine Adresse für die
// Bestätigung M16 (Variante Portfolio) – der Galerie-Eintrag speichert sie nicht. Kam der Widerruf nicht per Mail, antwortest
// du dort und lässt das Feld leer.

export function GalleryWithdraw({ id, title }: { id: number; title: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [locale, setLocale] = useState<'de' | 'en'>('de')
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const running = useRef(false)
  const emailId = useId()
  const localeId = useId()

  const run = async () => {
    if (running.current) return
    running.current = true
    setBusy(true)
    setFeedback(null)
    try {
      const res = await postAdminAction<{ mailQueued?: boolean }>(
        `/api/tattoo-gallery/${id}/withdraw-consent`,
        { email: email.trim() || null, locale },
      )
      setOpen(false)
      setFeedback({
        tone: 'success',
        text: res.unchanged
          ? adminText('actionUnchanged')
          : tattooText(res.mailQueued ? 'withdrawDoneMail' : 'withdrawDone'),
      })
      router.refresh()
    } catch (err) {
      setFeedback({
        tone: 'error',
        text:
          err instanceof AdminActionError
            ? err.message
            : adminText('actionFailed', { message: String((err as Error)?.message ?? err) }),
      })
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  return (
    <span className="pc-admin-action" id={`widerruf-${id}`}>
      <button
        type="button"
        className="pc-admin-btn pc-admin-btn--danger"
        data-testid="gallery-withdraw"
        onClick={() => setOpen(true)}
      >
        {tattooText('withdrawButton')}
        <span className="pc-visually-hidden">: {title}</span>
      </button>
      <ConfirmDialog
        open={open}
        title={tattooText('withdrawTitle')}
        consequence={tattooText('withdrawConsequence')}
        confirmLabel={tattooText('withdrawConfirm')}
        danger
        busy={busy}
        onConfirm={() => void run()}
        onCancel={() => setOpen(false)}
      >
        <div className="pc-field">
          <label htmlFor={emailId} className="pc-field__label">
            {tattooText('withdrawEmail')}
          </label>
          <input
            id={emailId}
            type="email"
            autoComplete="off"
            value={email}
            aria-describedby={`${emailId}-hint`}
            data-testid="gallery-withdraw-email"
            onChange={(e) => setEmail(e.target.value)}
          />
          <p id={`${emailId}-hint`} className="pc-piece__hint">
            {tattooText('withdrawEmailHint')}
          </p>
        </div>
        {email.trim() ? (
          <div className="pc-field">
            <label htmlFor={localeId} className="pc-field__label">
              {tattooText('withdrawLocale')}
            </label>
            <select
              id={localeId}
              value={locale}
              onChange={(e) => setLocale(e.target.value === 'en' ? 'en' : 'de')}
            >
              <option value="de">{tattooText('german')}</option>
              <option value="en">{tattooText('english')}</option>
            </select>
          </div>
        ) : null}
        {feedback?.tone === 'error' ? <Notice tone="error">{feedback.text}</Notice> : null}
      </ConfirmDialog>
      {feedback && !open ? (
        <Notice tone={feedback.tone} data-testid={`gallery-withdraw-${feedback.tone}`}>
          {feedback.text}
        </Notice>
      ) : null}
    </span>
  )
}
