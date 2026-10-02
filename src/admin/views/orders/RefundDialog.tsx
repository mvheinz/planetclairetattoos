'use client'

import { useRouter } from 'next/navigation'
import React, { useId, useState } from 'react'

import { formatMoney } from '@/lib/money'

import { ActionButton } from '../../components/ActionButton'
import { postAdminAction } from '../../components/adminAction'
import { EuroInputControl } from '../../components/EuroInputControl'
import { Notice } from '../../components/Notice'
import { adminText } from '../../translations'

// Dialog „Erstatten“ (PLAN P6.10, KONZEPT §5.3/§7.10, R-072): im Widerruf (Grund fest `withdrawal`) und in der
// Bestellung (Grund Pflicht: Storno, Bruch, Kulanz, Reklamation). Positionen wählen → Vorschlag vom Server (gleiche
// Rechnung wie beim Absenden); Betrag nur erhöhbar mit Notiz, nie über den Rest. Bei Teil-Widerruf Hinweis auf K-09.
// Karte/PayPal: „Erstatten“ (über den Zahlungsanbieter); Vorkasse: erst selbst überweisen, dann „Erstattung
// überwiesen“ bestätigen – keine Kund:innen-IBAN im Shop.

export interface RefundProposalView {
  itemsCents: number
  shippingCents: number
  proposedCents: number
  maxCents: number
  partial: boolean
}

export interface RefundDialogProps {
  orderId: number
  orderNumber: string
  prepayment: boolean
  items: {
    id: string
    label: string
    priceCents: number
    refunded: boolean
    preselected: boolean
  }[]
  proposal: RefundProposalView
  pending: boolean
  refundable: boolean
  /** Im Widerruf: Grund fest `withdrawal`. */
  withdrawalId?: number
  reasons?: { value: string; label: string }[]
}

const euro = (c: number) => formatMoney(c, 'de')

export function RefundDialog(props: RefundDialogProps) {
  const router = useRouter()
  const base = useId()
  const [selected, setSelected] = useState<string[]>(
    props.items.filter((i) => i.preselected && !i.refunded).map((i) => i.id),
  )
  const [proposal, setProposal] = useState<RefundProposalView>(props.proposal)
  const [amount, setAmount] = useState<number | null>(props.proposal.proposedCents || null)
  const [note, setNote] = useState('')
  const [reason, setReason] = useState(props.withdrawalId ? 'withdrawal' : '')
  const [transferred, setTransferred] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!props.refundable) return null
  if (props.pending) {
    return (
      <Notice tone="info" data-testid="refund-pending">
        {adminText('refundPending')}
      </Notice>
    )
  }

  const toggle = async (id: string, on: boolean) => {
    const next = on ? [...selected, id] : selected.filter((s) => s !== id)
    setSelected(next)
    setError(null)
    try {
      const res = await fetch(
        `/api/orders/${props.orderId}/refund-proposal?items=${encodeURIComponent(next.join(','))}`,
        { credentials: 'include' },
      )
      const json = (await res.json()) as { proposal?: RefundProposalView; error?: string }
      if (!res.ok || !json.proposal) throw new Error(json.error ?? res.statusText)
      setProposal(json.proposal)
      setAmount(json.proposal.proposedCents || null)
    } catch (err) {
      setError(adminText('actionFailed', { message: (err as Error).message }))
    }
  }

  const raised = amount !== null && amount > proposal.proposedCents
  const valid =
    amount !== null &&
    amount > 0 &&
    amount <= proposal.maxCents &&
    amount >= proposal.proposedCents &&
    (!raised || note.trim().length >= 3) &&
    reason !== '' &&
    (!props.prepayment || transferred)

  return (
    <section
      className="pc-order__section"
      aria-labelledby={`${base}-h`}
      data-testid="refund-dialog"
    >
      <h3 id={`${base}-h`}>{adminText('refundTitle')}</h3>
      {!props.withdrawalId ? (
        <div className="pc-field">
          <label htmlFor={`${base}-reason`} className="pc-field__label">
            {adminText('refundReason')}
          </label>
          <select
            id={`${base}-reason`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            data-testid="refund-reason"
          >
            <option value="">{adminText('withdrawalCloseReasonPick')}</option>
            {(props.reasons ?? []).map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <fieldset className="pc-field">
        <legend className="pc-field__label">{adminText('refundItems')}</legend>
        {props.items.map((i) => (
          <label key={i.id} className="pc-admin-row">
            <input
              type="checkbox"
              checked={selected.includes(i.id)}
              disabled={i.refunded}
              onChange={(e) => void toggle(i.id, e.target.checked)}
              data-testid={`refund-item-${i.id}`}
            />{' '}
            {i.label} · {euro(i.priceCents)}
            {i.refunded ? ` (${adminText('refundItemDone')})` : ''}
          </label>
        ))}
      </fieldset>
      <p data-testid="refund-proposal">
        {adminText('refundProposal', {
          items: euro(proposal.itemsCents),
          shipping: euro(proposal.shippingCents),
          total: euro(proposal.proposedCents),
          max: euro(proposal.maxCents),
        })}
      </p>
      {proposal.partial ? (
        <Notice tone="info" data-testid="refund-k09">
          {adminText('refundPartialHint')}
        </Notice>
      ) : null}
      <div className="pc-field">
        <label htmlFor={`${base}-amount`} className="pc-field__label">
          {adminText('refundAmount')}
        </label>
        <EuroInputControl
          id={`${base}-amount`}
          value={amount}
          onChange={setAmount}
          invalidMessage={adminText('refundAmountInvalid')}
        />
      </div>
      <div className="pc-field">
        <label htmlFor={`${base}-note`} className="pc-field__label">
          {adminText(raised ? 'refundNoteRequired' : 'refundNote')}
        </label>
        <input
          id={`${base}-note`}
          type="text"
          maxLength={300}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          data-testid="refund-note"
        />
      </div>
      {props.prepayment ? (
        <label className="pc-admin-row">
          <input
            type="checkbox"
            checked={transferred}
            onChange={(e) => setTransferred(e.target.checked)}
            data-testid="refund-transferred"
          />{' '}
          {adminText('refundTransferredCheck')}
        </label>
      ) : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <p className="pc-admin-row">
        <ActionButton
          data-testid="refund-submit"
          disabled={!valid}
          effects={['money', 'mail']}
          confirm={{
            title: adminText('refundConfirm', {
              amount: euro(amount ?? 0),
              order: props.orderNumber,
            }),
            consequence: adminText(
              props.prepayment ? 'refundConsequencePrepayment' : 'refundConsequenceCard',
            ),
          }}
          action={() =>
            postAdminAction(`/api/orders/${props.orderId}/refund`, {
              reason,
              itemIds: selected,
              amountCents: amount,
              note: note.trim() || undefined,
              ...(props.withdrawalId ? { withdrawalId: props.withdrawalId } : {}),
              ...(props.prepayment ? { manualTransferConfirmed: transferred } : {}),
            })
          }
          onDone={() => router.refresh()}
        >
          {adminText(props.prepayment ? 'refundButtonPrepayment' : 'refundButton')}
        </ActionButton>
      </p>
    </section>
  )
}
