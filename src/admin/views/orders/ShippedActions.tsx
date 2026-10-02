'use client'

import { useRouter } from 'next/navigation'
import React, { useId, useRef, useState } from 'react'

import { ActionButton } from '../../components/ActionButton'
import { AdminActionError, postAdminAction } from '../../components/adminAction'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Notice } from '../../components/Notice'
import { adminText } from '../../translations'

// Knöpfe einer Karte in „Versendet“ (PLAN P5.16): „Zugestellt“ (O10, ohne Mail), „Sendungsnummer korrigieren“ bzw.
// „nachtragen“ mit Rückfrage „Versandmail erneut senden?“ – „Ja“ schickt eine neue M06, „Nein“ speichert nur –, und
// „Reklamation (Bruch)“ (bis P6 Sprung zu den Vorlagen).

export interface ShippedActionsProps {
  orderId: number
  orderNumber: string
  status: string
  carrier: string | null
  trackingNumber: string | null
  complaintHref: string
}

export function ShippedActions(props: ShippedActionsProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(props.trackingNumber ?? '')
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const running = useRef(false)
  const fieldId = useId()
  const label = props.trackingNumber ? 'shippedFixTracking' : 'shippedAddTracking'

  const save = async (resendMail: boolean) => {
    if (running.current) return
    running.current = true
    setBusy(true)
    setFeedback(null)
    try {
      const res = await postAdminAction<{ mailQueued?: boolean }>(
        `/api/orders/${props.orderId}/tracking`,
        {
          trackingNumber: value,
          ...(props.carrier ? { carrier: props.carrier } : {}),
          resendMail,
        },
      )
      setAsking(false)
      setEditing(false)
      setFeedback({
        tone: 'success',
        text: adminText(
          res.mailQueued
            ? 'shippedTrackingSavedMail'
            : res.unchanged
              ? 'actionUnchanged'
              : 'shippedTrackingSaved',
        ),
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
    <div className="pc-order__section" data-testid="shipped-actions">
      <div className="pc-admin-row">
        {props.status === 'shipped' ? (
          <ActionButton
            data-testid="mark-delivered"
            action={() => postAdminAction(`/api/orders/${props.orderId}/delivered`)}
            onDone={() => router.refresh()}
          >
            {adminText('shippedDelivered')}
          </ActionButton>
        ) : null}
        <button
          type="button"
          className="pc-admin-btn pc-admin-btn--secondary"
          aria-expanded={editing}
          onClick={() => setEditing((v) => !v)}
          data-testid="fix-tracking"
        >
          {adminText(label)}
        </button>
        <a
          className="pc-admin-btn pc-admin-btn--secondary"
          href={props.complaintHref}
          data-testid="complaint-link"
        >
          {adminText('shippedComplaint')}
        </a>
      </div>
      {editing ? (
        <div className="pc-field">
          <label htmlFor={fieldId} className="pc-field__label">
            {adminText('packingTracking')}
          </label>
          <input
            id={fieldId}
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <p className="pc-admin-row">
            <button
              type="button"
              className="pc-admin-btn pc-admin-btn--primary"
              disabled={busy || value.trim() === ''}
              onClick={() => setAsking(true)}
              data-testid="fix-tracking-save"
            >
              {adminText('shippedTrackingSave')}
            </button>
          </p>
        </div>
      ) : null}
      <ConfirmDialog
        open={asking}
        title={adminText('shippedResendTitle')}
        consequence={adminText('shippedResendConsequence', { order: props.orderNumber })}
        confirmLabel={adminText('shippedResendYes')}
        busy={busy}
        onConfirm={() => void save(true)}
        onCancel={() => setAsking(false)}
      >
        <p className="pc-admin-row">
          <button
            type="button"
            className="pc-admin-btn pc-admin-btn--secondary"
            disabled={busy}
            onClick={() => void save(false)}
            data-testid="fix-tracking-no-mail"
          >
            {adminText('shippedResendNo')}
          </button>
        </p>
        {feedback?.tone === 'error' ? <Notice tone="error">{feedback.text}</Notice> : null}
      </ConfirmDialog>
      {feedback && !asking ? (
        <div role="status">
          <Notice tone={feedback.tone}>{feedback.text}</Notice>
        </div>
      ) : null}
    </div>
  )
}
