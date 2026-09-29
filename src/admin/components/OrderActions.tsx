'use client'

import { useConfig, useDocumentInfo, useFormFields, useTranslation } from '@payloadcms/ui'
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'

import { MoneyAmount } from '@/components/shop/MoneyAmount'
import { formatEuroInput, parseEuroInput } from '@/lib/money'
import { systemClock } from '@/lib/time'

import {
  availableOrderActions,
  daysUntilCancel,
  ORDER_ACTION_ENDPOINT,
  type OrderActionKind,
} from './orderActionsModel'

// „Aktionen“ in der Bestell-Bearbeitungsansicht (PLAN P4.20): Knöpfe je Status mit Bestätigungsdialog, der die Folge
// nennt; Betrag, Verwendungszweck und Resttage bis zum Storno; je Klick ein Idempotenz-Schlüssel, Knopf gesperrt,
// solange die Anfrage läuft. Endpunkte `POST /api/orders/:id/{prepayment-received,cancel,late-payment}`.

type T = (key: string, vars?: Record<string, unknown>) => string

const LABEL: Record<OrderActionKind, string> = {
  prepaymentReceived: 'custom:orderActionsPaid',
  cancel: 'custom:orderActionsCancel',
  reactivate: 'custom:orderActionsLate',
  refundTransferDone: 'custom:orderActionsRefundDone',
}
const CONSEQUENCE: Record<OrderActionKind, string> = {
  prepaymentReceived: 'custom:orderActionsPaidConfirm',
  cancel: 'custom:orderActionsCancelConfirm',
  reactivate: 'custom:orderActionsLateConfirm',
  refundTransferDone: 'custom:orderActionsRefundDoneConfirm',
}

const box: CSSProperties = {
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: 4,
  padding: 'calc(var(--base) * 0.75)',
  marginBottom: 'var(--base)',
  maxWidth: '100%',
}
const row: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 'calc(var(--base) * 0.5)' }
const field: CSSProperties = { display: 'grid', gap: 4, marginBottom: 'calc(var(--base) * 0.5)' }

function newKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export function OrderActions() {
  const { id } = useDocumentInfo()
  const { config } = useConfig()
  const { t: rawT } = useTranslation()
  const t = rawT as unknown as T
  const status = useFormFields(([f]) => f.status?.value as string | undefined)
  const cancelReason = useFormFields(([f]) => f.cancelReason?.value as string | undefined)
  const totalCents = useFormFields(([f]) => f.totalCents?.value as number | undefined)
  const orderNumber = useFormFields(([f]) => f.orderNumber?.value as string | undefined)
  const dueAt = useFormFields(([f]) => f['prepayment.dueAt']?.value as string | undefined)

  const [open, setOpen] = useState<OrderActionKind | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [receivedAt, setReceivedAt] = useState('')
  const [text, setText] = useState('')
  const [confirmMismatch, setConfirmMismatch] = useState(false)
  const key = useRef<string>('')
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (open && !d.open) d.showModal?.()
    if (!open && d.open) d.close()
  }, [open])

  const actions = availableOrderActions({ status, cancelReason })
  if (!id || actions.length === 0) return null

  const days = dueAt ? daysUntilCancel(dueAt, systemClock.now()) : null
  const cents = parseEuroInput(amount)
  const mismatch =
    open === 'prepaymentReceived' &&
    cents !== null &&
    totalCents !== undefined &&
    cents !== totalCents

  const start = (kind: OrderActionKind) => {
    key.current = newKey()
    setError(null)
    setAmount(formatEuroInput(totalCents ?? null))
    setReceivedAt('')
    setText('')
    setConfirmMismatch(false)
    setOpen(kind)
  }

  const submit = async () => {
    if (!open || busy) return
    const spec = ORDER_ACTION_ENDPOINT[open]
    const body: Record<string, unknown> = { ...(spec.body ?? {}) }
    if (open === 'prepaymentReceived') {
      if (cents === null || cents <= 0) return setError(t('custom:euroInputInvalid'))
      body.amountCents = cents
      if (receivedAt) body.receivedAt = new Date(`${receivedAt}T12:00:00`).toISOString()
      if (mismatch) body.confirmMismatch = confirmMismatch
    }
    if (open === 'cancel') body.reason = text
    if (open === 'refundTransferDone' && text) body.note = text
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`${config.serverURL}${config.routes.api}/orders/${id}/${spec.path}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'idempotency-key': key.current },
        body: JSON.stringify(body),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(t('custom:orderActionsError', { message: json.error ?? res.statusText }))
        setBusy(false)
        return
      }
      setOpen(null)
      window.location.reload()
    } catch (e) {
      setError(t('custom:orderActionsError', { message: (e as Error).message }))
      setBusy(false)
    }
  }

  const daysText =
    days === null
      ? null
      : days < 0
        ? t('custom:orderActionsOverdue')
        : days === 0
          ? t('custom:orderActionsDueToday')
          : days === 1
            ? t('custom:orderActionsDaysLeftOne')
            : t('custom:orderActionsDaysLeft', { days })

  return (
    <section style={box} aria-label={t('custom:orderActionsTitle')} data-testid="order-actions">
      <h3 style={{ marginTop: 0 }}>{t('custom:orderActionsTitle')}</h3>
      {totalCents !== undefined ? (
        <p style={{ margin: 0 }}>
          {t('custom:orderActionsAmount')}:{' '}
          <strong>
            <MoneyAmount cents={totalCents} locale="de" />
          </strong>
        </p>
      ) : null}
      {orderNumber ? (
        <p style={{ margin: 0 }}>
          {t('custom:orderActionsReference')}: <strong>{orderNumber}</strong>
        </p>
      ) : null}
      {status === 'awaiting_prepayment' && daysText ? (
        <p style={{ marginTop: 0 }}>{daysText}</p>
      ) : null}
      <div style={row}>
        {actions.map((kind) => (
          <button
            key={kind}
            type="button"
            className={`btn btn--size-medium ${kind === 'cancel' ? 'btn--style-secondary' : 'btn--style-primary'}`}
            onClick={() => start(kind)}
            disabled={busy}
          >
            {t(LABEL[kind])}
          </button>
        ))}
      </div>

      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        aria-describedby={descId}
        onClose={() => {
          if (!busy) setOpen(null)
        }}
        style={{
          maxWidth: 'min(32rem, calc(100vw - 32px))',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {open ? (
          // Kein <form>: die Komponente steht im Formular der Bestellung (verschachtelte Formulare sind ungültig).
          <div>
            <h2 id={titleId} style={{ marginTop: 0 }}>
              {t(LABEL[open])}
            </h2>
            <p id={descId}>{t(CONSEQUENCE[open])}</p>
            {open === 'prepaymentReceived' ? (
              <>
                <label style={field}>
                  {t('custom:orderActionsReceivedAmount')}
                  <input
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </label>
                <label style={field}>
                  {t('custom:orderActionsReceivedAt')}
                  <input
                    type="date"
                    value={receivedAt}
                    onChange={(e) => setReceivedAt(e.target.value)}
                  />
                </label>
                {mismatch ? (
                  <label style={{ ...field, display: 'flex', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={confirmMismatch}
                      onChange={(e) => setConfirmMismatch(e.target.checked)}
                    />
                    {t('custom:orderActionsMismatch')}
                  </label>
                ) : null}
              </>
            ) : null}
            {open === 'cancel' || open === 'refundTransferDone' ? (
              <label style={field}>
                {t(
                  open === 'cancel' ? 'custom:orderActionsCancelReason' : 'custom:orderActionsNote',
                )}
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={300}
                  rows={3}
                  required={open === 'cancel'}
                />
              </label>
            ) : null}
            {error ? (
              <p role="alert" style={{ color: 'var(--theme-error-500)' }}>
                {error}
              </p>
            ) : null}
            <div style={row}>
              <button
                type="button"
                onClick={() => void submit()}
                className="btn btn--size-medium btn--style-primary"
                disabled={busy || (mismatch && !confirmMismatch)}
              >
                {busy ? t('custom:orderActionsBusy') : t('custom:orderActionsConfirm')}
              </button>
              <button
                type="button"
                className="btn btn--size-medium btn--style-secondary"
                onClick={() => setOpen(null)}
                disabled={busy}
              >
                {t('custom:orderActionsAbort')}
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
    </section>
  )
}
