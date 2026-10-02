'use client'

import { useRouter } from 'next/navigation'
import React, { useId, useState } from 'react'

import { ActionButton } from '../../components/ActionButton'
import { postAdminAction } from '../../components/adminAction'
import { Notice } from '../../components/Notice'
import { StatusBadge } from '../../components/StatusBadge'
import { adminText } from '../../translations'

// Reklamationen im Bestell-Detail (PLAN P6.11, KONZEPT §7.8, R-110–R-112): Akte anlegen (Art, Eingang, betroffene
// Stücke, Beschreibung), je Akte die Frist „bis {Datum} bei DHL reklamieren“, Gewährleistungsende, „Reklamation
// beantworten“ (M12) und „Streitbeilegungshinweis senden“ (M13). Fotos, Abhilfe, Wahl der Kundin und „bei DHL
// reklamiert am“ pflegt Jutta in der Akte selbst (Link). Häkchen sind nie vorbelegt (V-03).

export interface ComplaintView {
  id: number
  kindLabel: string
  statusLabel: string
  receivedAt: string
  items: string[]
  description: string | null
  carrierClaimDueAt: string | null
  carrierClaimFiledAt: string | null
  warrantyEndsAt: string | null
  remedyLabel: string | null
  customerChoiceLabel: string | null
  repairChoiceSentAt: string | null
  vsbgNoticeSentAt: string | null
  photoCount: number
}

export interface ComplaintsPanelProps {
  orderId: number
  adminRoute: string
  allowed: boolean
  kinds: { value: string; label: string }[]
  items: { id: string; label: string }[]
  complaints: ComplaintView[]
}

function ComplaintCard({
  c,
  orderId,
  adminRoute,
}: {
  c: ComplaintView
  orderId: number
  adminRoute: string
}) {
  const router = useRouter()
  return (
    <li className="pc-order__card" data-testid="complaint-card" data-complaint-id={c.id}>
      <p className="pc-order__meta">
        <strong>{c.kindLabel}</strong> · {adminText('complaintReceived', { date: c.receivedAt })} ·{' '}
        <StatusBadge tone="info">{c.statusLabel}</StatusBadge>
      </p>
      {c.items.length > 0 ? (
        <ul className="pc-order__items">
          {c.items.map((label) => (
            <li key={label} className="pc-order__item">
              {label}
            </li>
          ))}
        </ul>
      ) : null}
      {c.description ? <p className="pc-order__notes">{c.description}</p> : null}
      {c.carrierClaimDueAt && !c.carrierClaimFiledAt ? (
        <Notice tone="warning" data-testid="complaint-carrier-due">
          {adminText('complaintCarrierDue', { date: c.carrierClaimDueAt })}
        </Notice>
      ) : null}
      <ul data-testid="complaint-facts">
        {c.carrierClaimFiledAt ? (
          <li>{adminText('complaintCarrierFiled', { date: c.carrierClaimFiledAt })}</li>
        ) : null}
        <li data-testid="complaint-warranty">
          {c.warrantyEndsAt
            ? adminText('complaintWarranty', { date: c.warrantyEndsAt })
            : adminText('complaintWarrantyOpen')}
        </li>
        {c.remedyLabel ? <li>{adminText('complaintRemedy', { remedy: c.remedyLabel })}</li> : null}
        {c.customerChoiceLabel ? (
          <li>{adminText('complaintChoice', { choice: c.customerChoiceLabel })}</li>
        ) : null}
        {c.photoCount > 0 ? <li>{adminText('complaintPhotos', { count: c.photoCount })}</li> : null}
        {c.repairChoiceSentAt ? (
          <li data-testid="complaint-reply-sent">
            {adminText('complaintReplySent', { date: c.repairChoiceSentAt })}
          </li>
        ) : null}
        {c.vsbgNoticeSentAt ? (
          <li data-testid="complaint-vsbg-sent">
            {adminText('complaintVsbgSent', { date: c.vsbgNoticeSentAt })}
          </li>
        ) : null}
      </ul>
      <p className="pc-admin-row">
        <a
          className="pc-admin-btn pc-admin-btn--secondary"
          href={`${adminRoute}/collections/complaints/${c.id}`}
          data-testid="complaint-open"
        >
          {adminText('complaintOpen')}
        </a>
        {c.repairChoiceSentAt ? null : (
          <ActionButton
            data-testid="complaint-reply"
            effects={['mail']}
            confirm={{
              title: adminText('complaintReplyConfirm'),
              consequence: adminText('complaintReplyConsequence'),
            }}
            action={() =>
              postAdminAction(`/api/orders/${orderId}/complaint-reply`, { complaintId: c.id })
            }
            onDone={() => router.refresh()}
          >
            {adminText('complaintReply')}
          </ActionButton>
        )}
        {c.vsbgNoticeSentAt ? null : (
          <ActionButton
            variant="secondary"
            data-testid="complaint-dispute"
            effects={['mail']}
            confirm={{
              title: adminText('complaintDisputeConfirm'),
              consequence: adminText('complaintDisputeConsequence'),
            }}
            action={() =>
              postAdminAction(`/api/orders/${orderId}/complaint-dispute`, { complaintId: c.id })
            }
            onDone={() => router.refresh()}
          >
            {adminText('complaintDispute')}
          </ActionButton>
        )}
      </p>
    </li>
  )
}

export function ComplaintsPanel(props: ComplaintsPanelProps) {
  const router = useRouter()
  const base = useId()
  const [kind, setKind] = useState(props.kinds[0]?.value ?? 'transport_damage')
  const [receivedAt, setReceivedAt] = useState('')
  const [description, setDescription] = useState('')
  const [selected, setSelected] = useState<string[]>([])

  return (
    <div data-testid="complaints-panel">
      {props.complaints.length === 0 ? (
        <p data-testid="complaints-none">{adminText('complaintsNone')}</p>
      ) : (
        <ul className="pc-order__list" data-testid="complaints-list">
          {props.complaints.map((c) => (
            <ComplaintCard key={c.id} c={c} orderId={props.orderId} adminRoute={props.adminRoute} />
          ))}
        </ul>
      )}
      {!props.allowed ? (
        <p className="pc-order__muted">{adminText('complaintsNotPaid')}</p>
      ) : (
        <details data-testid="complaint-new">
          <summary>{adminText('complaintNew')}</summary>
          <div className="pc-field">
            <label htmlFor={`${base}-kind`} className="pc-field__label">
              {adminText('complaintKind')}
            </label>
            <select
              id={`${base}-kind`}
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              data-testid="complaint-kind"
            >
              {props.kinds.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
          <div className="pc-field">
            <label htmlFor={`${base}-received`} className="pc-field__label">
              {adminText('complaintReceivedAt')}
            </label>
            <input
              id={`${base}-received`}
              type="date"
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
              data-testid="complaint-received"
            />
          </div>
          {props.items.length > 0 ? (
            <fieldset className="pc-field">
              <legend className="pc-field__label">{adminText('complaintItems')}</legend>
              {props.items.map((item) => (
                <label key={item.id} className="pc-admin-row">
                  <input
                    type="checkbox"
                    checked={selected.includes(item.id)}
                    onChange={(e) =>
                      setSelected((s) =>
                        e.target.checked ? [...s, item.id] : s.filter((x) => x !== item.id),
                      )
                    }
                    data-testid="complaint-item"
                  />{' '}
                  {item.label}
                </label>
              ))}
            </fieldset>
          ) : null}
          <div className="pc-field">
            <label htmlFor={`${base}-desc`} className="pc-field__label">
              {adminText('complaintDescription')}
            </label>
            <textarea
              id={`${base}-desc`}
              rows={3}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="complaint-description"
            />
          </div>
          <p className="pc-admin-row">
            <ActionButton
              data-testid="complaint-create"
              action={async () => {
                await postAdminAction(`/api/orders/${props.orderId}/complaint`, {
                  kind,
                  receivedAt: receivedAt || null,
                  description: description || null,
                  affectedItemIds: selected,
                })
                return { message: adminText('complaintCreated') }
              }}
              onDone={() => {
                setDescription('')
                setSelected([])
                router.refresh()
              }}
            >
              {adminText('complaintCreate')}
            </ActionButton>
          </p>
        </details>
      )}
    </div>
  )
}
