'use client'

import { useRouter } from 'next/navigation'
import React, { useId, useRef, useState } from 'react'

import { ActionButton } from '../../components/ActionButton'
import { AdminActionError, postAdminAction } from '../../components/adminAction'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Notice } from '../../components/Notice'
import { adminText } from '../../translations'

// Knöpfe im Anfrage-Detail (PLAN P5.20, KONZEPT §7.11): Status-Knöpfe nach `INQUIRY_TRANSITIONS` (ohne Wirkung nach
// außen, darum ohne Rückfrage), „Antworten“ (`mailto:` aus Juttas eigenem Postfach) und „Jetzt löschen“ (Dialog,
// löscht Anfrage und Bilder sofort; Eintrag im Löschprotokoll).

export interface InquiryActionsProps {
  inquiryId: number
  reference: string
  replyHref: string
  transitions: { status: string; label: string; reopen: boolean }[]
  legalHold: boolean
  listHref: string
}

export function InquiryStatusButtons(
  props: Pick<InquiryActionsProps, 'inquiryId' | 'transitions'>,
) {
  const router = useRouter()
  return (
    <div className="pc-admin-row" data-testid="inquiry-status-buttons">
      {props.transitions.map((t) => (
        <ActionButton
          key={t.status}
          variant="secondary"
          data-testid={`inquiry-status-${t.status}`}
          action={() =>
            postAdminAction(`/api/inquiries/${props.inquiryId}/status`, { status: t.status })
          }
          onDone={() => router.refresh()}
        >
          {t.reopen
            ? adminText('inquiryReopen')
            : adminText('inquirySetStatus', { status: t.label })}
        </ActionButton>
      ))}
    </div>
  )
}

export function InquiryReplyAndDelete(props: InquiryActionsProps) {
  const router = useRouter()
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const running = useRef(false)
  const hintId = useId()

  const remove = async () => {
    if (running.current) return
    running.current = true
    setBusy(true)
    setError(null)
    try {
      await postAdminAction(`/api/inquiries/${props.inquiryId}/delete-now`, {
        reference: props.reference,
      })
      setAsking(false)
      router.push(`${props.listHref}?geloescht=${encodeURIComponent(props.reference)}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof AdminActionError ? err.message : (err as Error).message)
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  return (
    <div className="pc-order__section" data-testid="inquiry-actions">
      <div className="pc-admin-row">
        <a
          className="pc-admin-btn pc-admin-btn--primary"
          href={props.replyHref}
          data-testid="inquiry-reply"
        >
          {adminText('inquiryReply')}
        </a>
        <button
          type="button"
          className="pc-admin-btn pc-admin-btn--danger"
          disabled={busy || props.legalHold}
          aria-describedby={props.legalHold ? hintId : undefined}
          onClick={() => {
            setError(null)
            setAsking(true)
          }}
          data-testid="inquiry-delete"
        >
          {adminText('inquiryDeleteNow')}
        </button>
      </div>
      {props.legalHold ? (
        <p id={hintId} className="pc-order__muted">
          {adminText('inquiryLegalHold')}
        </p>
      ) : null}
      <ConfirmDialog
        open={asking}
        title={adminText('inquiryDeleteTitle', { reference: props.reference })}
        consequence={adminText('inquiryDeleteConsequence')}
        confirmLabel={adminText('inquiryDeleteNow')}
        danger
        busy={busy}
        onConfirm={() => void remove()}
        onCancel={() => setAsking(false)}
      >
        {error ? <Notice tone="error">{error}</Notice> : null}
      </ConfirmDialog>
    </div>
  )
}
