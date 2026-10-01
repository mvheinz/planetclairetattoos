'use client'

import { useRouter } from 'next/navigation'
import React, { useId, useRef, useState } from 'react'

import { ActionButton } from '../../components/ActionButton'
import { AdminActionError, postAdminAction } from '../../components/adminAction'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { CopyButton } from '../../components/CopyButton'
import { Notice } from '../../components/Notice'
import { formatEuroInput, formatMoney, parseEuroInput } from '@/lib/money'
import { adminText } from '../../translations'

// Knöpfe einer Karte in „Vorkasse offen“ (PLAN P5.18, KONZEPT §7.7, §4.8) über die Endpunkte aus P4.20:
// „Zahlung erhalten“ (O3; Dialog mit Betrag und Verwendungszweck, eingegangener Betrag Pflicht, Abweichung → Warnung und
// bewusste Bestätigung, optional Eingangsdatum), „Stornieren“ (O4, Grund Pflicht, M04), „Bankdaten kopieren“; in der
// Unterliste „Nachträglich bezahlt“ (O5) bzw. – ist ein Stück schon weg – Hinweis, Vorlage „Bitte um IBAN“ und
// „Rücküberweisung erledigt“.

type Feedback = { tone: 'success' | 'error'; text: string } | null

function useAction() {
  const router = useRouter()
  const running = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<Feedback>(null)
  const run = async (url: string, body: Record<string, unknown>, onOk: () => void) => {
    if (running.current) return
    running.current = true
    setBusy(true)
    setError(null)
    try {
      const res = await postAdminAction(url, body)
      onOk()
      setDone({
        tone: 'success',
        text: adminText(res.unchanged ? 'actionUnchanged' : 'actionDone'),
      })
      router.refresh()
    } catch (err) {
      setError(err instanceof AdminActionError ? err.message : (err as Error).message)
    } finally {
      running.current = false
      setBusy(false)
    }
  }
  return { busy, error, setError, done, run }
}

export interface PrepaymentOpenActionsProps {
  orderId: number
  orderNumber: string
  totalCents: number
  bankText: string | null
}

export function PrepaymentOpenActions(props: PrepaymentOpenActionsProps) {
  const { busy, error, setError, done, run } = useAction()
  const [open, setOpen] = useState<'paid' | 'cancel' | null>(null)
  const [amount, setAmount] = useState('')
  const [receivedAt, setReceivedAt] = useState('')
  const [confirmMismatch, setConfirmMismatch] = useState(false)
  const [reason, setReason] = useState('')
  const amountId = useId()
  const amountHint = useId()
  const dateId = useId()
  const reasonId = useId()

  const cents = parseEuroInput(amount)
  const mismatch = cents !== null && cents > 0 && cents !== props.totalCents
  const start = (kind: 'paid' | 'cancel') => {
    setError(null)
    setAmount(formatEuroInput(props.totalCents))
    setReceivedAt('')
    setConfirmMismatch(false)
    setReason('')
    setOpen(kind)
  }
  const close = () => {
    if (!busy) setOpen(null)
  }

  const submitPaid = () => {
    if (cents === null || cents <= 0) return setError(adminText('euroInputInvalid'))
    const body: Record<string, unknown> = { amountCents: cents }
    if (receivedAt) body.receivedAt = new Date(`${receivedAt}T12:00:00`).toISOString()
    if (mismatch) body.confirmMismatch = confirmMismatch
    void run(`/api/orders/${props.orderId}/prepayment-received`, body, () => setOpen(null))
  }
  const submitCancel = () => {
    void run(`/api/orders/${props.orderId}/cancel`, { reason: reason.trim() }, () => setOpen(null))
  }

  return (
    <div className="pc-order__section" data-testid="prepayment-actions">
      <div className="pc-admin-row">
        <button
          type="button"
          className="pc-admin-btn pc-admin-btn--primary"
          onClick={() => start('paid')}
          disabled={busy}
          data-testid="prepayment-received"
        >
          {adminText('prepaymentReceived')}
        </button>
        <button
          type="button"
          className="pc-admin-btn pc-admin-btn--secondary"
          onClick={() => start('cancel')}
          disabled={busy}
          data-testid="prepayment-cancel"
        >
          {adminText('prepaymentCancel')}
        </button>
        {props.bankText ? (
          <CopyButton
            text={props.bankText}
            label={adminText('prepaymentCopyBank')}
            data-testid="prepayment-copy-bank"
          />
        ) : null}
      </div>
      {!props.bankText ? <Notice tone="warning">{adminText('prepaymentNoBank')}</Notice> : null}

      <ConfirmDialog
        open={open === 'paid'}
        title={adminText('prepaymentReceivedTitle', { order: props.orderNumber })}
        consequence={adminText('prepaymentReceivedConsequence')}
        busy={busy}
        confirmDisabled={cents === null || cents <= 0 || (mismatch && !confirmMismatch)}
        onConfirm={submitPaid}
        onCancel={close}
      >
        <dl className="pc-order__facts">
          <dt>{adminText('prepaymentExpected')}</dt>
          <dd data-testid="prepayment-expected">{formatMoney(props.totalCents, 'de')}</dd>
          <dt>{adminText('prepaymentReference')}</dt>
          <dd>
            <strong>{props.orderNumber}</strong>
          </dd>
        </dl>
        <div className="pc-field">
          <label htmlFor={amountId} className="pc-field__label">
            {adminText('prepaymentAmount')}
          </label>
          <input
            id={amountId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            required
            aria-describedby={amountHint}
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value)
              setConfirmMismatch(false)
            }}
            data-testid="prepayment-amount"
          />
          <p id={amountHint} className="pc-order__muted">
            {adminText('euroInputHint')}
          </p>
        </div>
        {mismatch ? (
          <div data-testid="prepayment-mismatch">
            <Notice tone="warning">
              {adminText('prepaymentMismatch', {
                amount: formatMoney(cents!, 'de'),
                total: formatMoney(props.totalCents, 'de'),
              })}
            </Notice>
            <label className="pc-choice">
              <input
                type="checkbox"
                checked={confirmMismatch}
                onChange={(e) => setConfirmMismatch(e.target.checked)}
                data-testid="prepayment-mismatch-confirm"
              />
              {adminText('prepaymentMismatchConfirm')}
            </label>
          </div>
        ) : null}
        <div className="pc-field">
          <label htmlFor={dateId} className="pc-field__label">
            {adminText('prepaymentReceivedAt')}
          </label>
          <input
            id={dateId}
            type="date"
            value={receivedAt}
            onChange={(e) => setReceivedAt(e.target.value)}
            data-testid="prepayment-received-at"
          />
        </div>
        {error ? <Notice tone="error">{error}</Notice> : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={open === 'cancel'}
        title={adminText('prepaymentCancelTitle', { order: props.orderNumber })}
        consequence={adminText('prepaymentCancelConsequence')}
        confirmLabel={adminText('prepaymentCancel')}
        danger
        busy={busy}
        confirmDisabled={reason.trim().length < 3}
        onConfirm={submitCancel}
        onCancel={close}
      >
        <div className="pc-field">
          <label htmlFor={reasonId} className="pc-field__label">
            {adminText('prepaymentCancelReason')}
          </label>
          <textarea
            id={reasonId}
            rows={3}
            maxLength={300}
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            data-testid="prepayment-cancel-reason"
          />
        </div>
        {error ? <Notice tone="error">{error}</Notice> : null}
      </ConfirmDialog>

      {done && !open ? <Notice tone={done.tone}>{done.text}</Notice> : null}
    </div>
  )
}

export interface PrepaymentLateActionsProps {
  orderId: number
  orderNumber: string
  allAvailable: boolean
  refundNoted: boolean
  /** Pfad zu den Vorlagen („Bitte um IBAN“, P5.27). */
  templatesHref: string
}

export function PrepaymentLateActions(props: PrepaymentLateActionsProps) {
  const router = useRouter()
  const [gone, setGone] = useState(!props.allAvailable)

  return (
    <div className="pc-order__section" data-testid="late-actions">
      {gone ? (
        <>
          <Notice
            tone="warning"
            data-testid="late-gone"
            action={{ href: props.templatesHref, label: adminText('prepaymentIbanTemplate') }}
          >
            {adminText('prepaymentGone')}
          </Notice>
          {props.refundNoted ? (
            <p className="pc-order__muted" data-testid="late-refund-noted">
              {adminText('prepaymentRefundNoted')}
            </p>
          ) : (
            <p className="pc-admin-row">
              <ActionButton
                variant="secondary"
                data-testid="late-refund-done"
                confirm={{
                  title: adminText('prepaymentRefundDoneTitle', { order: props.orderNumber }),
                  consequence: adminText('orderActionsRefundDoneConfirm'),
                }}
                action={() =>
                  postAdminAction(`/api/orders/${props.orderId}/late-payment`, {
                    action: 'refund_transfer_done',
                  })
                }
                onDone={() => router.refresh()}
              >
                {adminText('orderActionsRefundDone')}
              </ActionButton>
            </p>
          )}
        </>
      ) : (
        <p className="pc-admin-row">
          <ActionButton
            data-testid="late-paid"
            effects={['mail', 'money', 'stock']}
            confirm={{
              title: adminText('prepaymentLateTitle', { order: props.orderNumber }),
              consequence: adminText('orderActionsLateConfirm'),
            }}
            action={async () => {
              try {
                return await postAdminAction(`/api/orders/${props.orderId}/late-payment`, {
                  action: 'reactivate',
                })
              } catch (err) {
                if (err instanceof AdminActionError && err.code === 'items_unavailable') {
                  setGone(true)
                }
                throw err
              }
            }}
            onDone={() => router.refresh()}
          >
            {adminText('orderActionsLate')}
          </ActionButton>
        </p>
      )}
    </div>
  )
}
