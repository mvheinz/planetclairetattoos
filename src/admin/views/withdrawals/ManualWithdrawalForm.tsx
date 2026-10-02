'use client'

import { useRouter } from 'next/navigation'
import React, { useId, useState } from 'react'

import { ActionButton } from '../../components/ActionButton'
import { postAdminAction } from '../../components/adminAction'
import { adminText } from '../../translations'

// „Widerruf manuell erfassen“ in `/widerrufe` (PLAN P6.9, R-094, DM-WDR-04): Kanal (E-Mail, Brief, Sonstiges),
// Zugangszeitpunkt (Datum und Uhrzeit in Berlin, vom Server in UTC umgerechnet), Name, Vertrag, optional E-Mail,
// Stücke und Grund. „Eingangsbestätigung senden“ ist nie vorausgewählt und geht nur mit E-Mail.

export function ManualWithdrawalForm({
  channels,
}: {
  channels: { value: string; label: string }[]
}) {
  const router = useRouter()
  const base = useId()
  const [v, setV] = useState({
    channel: 'email',
    receivedAt: '',
    name: '',
    contractIdentification: '',
    email: '',
    itemsText: '',
    reason: '',
  })
  const [send, setSend] = useState(false)
  const [created, setCreated] = useState<string | null>(null)
  const set =
    (k: keyof typeof v) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setV((old) => ({ ...old, [k]: e.target.value }))
  const ready =
    v.receivedAt !== '' && v.name.trim().length >= 2 && v.contractIdentification.trim().length >= 3
  const field = (
    k: keyof typeof v,
    label: string,
    type: 'text' | 'email' | 'datetime-local' = 'text',
  ) => (
    <div className="pc-field">
      <label htmlFor={`${base}-${k}`} className="pc-field__label">
        {label}
      </label>
      <input
        id={`${base}-${k}`}
        type={type}
        value={v[k]}
        onChange={set(k)}
        data-testid={`manual-${k}`}
      />
    </div>
  )

  return (
    <details className="pc-order__section" data-testid="withdrawal-manual">
      <summary>{adminText('withdrawalManualTitle')}</summary>
      <p className="pc-order__muted">{adminText('withdrawalManualIntro')}</p>
      <div className="pc-field">
        <label htmlFor={`${base}-channel`} className="pc-field__label">
          {adminText('withdrawalManualChannel')}
        </label>
        <select
          id={`${base}-channel`}
          value={v.channel}
          onChange={set('channel')}
          data-testid="manual-channel"
        >
          {channels.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      {field('receivedAt', adminText('withdrawalManualReceivedAt'), 'datetime-local')}
      {field('name', adminText('withdrawalManualName'))}
      {field('contractIdentification', adminText('withdrawalManualContract'))}
      {field('email', adminText('withdrawalManualEmail'), 'email')}
      {field('itemsText', adminText('withdrawalManualItems'))}
      {field('reason', adminText('withdrawalManualReason'))}
      <div className="pc-field">
        <label>
          <input
            type="checkbox"
            checked={send}
            disabled={v.email.trim() === ''}
            onChange={(e) => setSend(e.target.checked)}
            data-testid="manual-send"
          />{' '}
          {adminText('withdrawalManualSend')}
        </label>
      </div>
      <p className="pc-admin-row">
        <ActionButton
          data-testid="manual-submit"
          disabled={!ready}
          confirm={{
            title: adminText('withdrawalManualConfirm'),
            consequence: adminText(
              send && v.email.trim()
                ? 'withdrawalManualConsequenceMail'
                : 'withdrawalManualConsequence',
            ),
          }}
          action={async () => {
            const res = await postAdminAction<{ doc: { reference: string } }>(
              '/api/withdrawals/manual',
              {
                ...v,
                // `datetime-local` als Berliner Ortszeit; der Server rechnet in UTC um (unabhängig vom Gerät)
                receivedAt: v.receivedAt,
                email: v.email.trim() || null,
                sendReceipt: send && v.email.trim() !== '',
              },
            )
            setCreated(res.doc.reference)
            return { message: adminText('withdrawalManualCreated', { ref: res.doc.reference }) }
          }}
          onDone={() => router.refresh()}
        >
          {adminText('withdrawalManualButton')}
        </ActionButton>
      </p>
      {created ? (
        <span hidden data-testid="manual-created">
          {created}
        </span>
      ) : null}
    </details>
  )
}
