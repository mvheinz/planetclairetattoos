'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

import { ActionButton } from '../../components/ActionButton'
import { postAdminAction } from '../../components/adminAction'
import { adminText, type AdminCustomKey } from '../../translations'

// „Löschen/Einschränken“ (PLAN P6.18, R-151, LOESCHKONZEPT §5.6/§5.7) und „Berichtigung“ (R-152) in
// `/export/datenschutz/:id`: Plan je Datensatz (Regel, Aufbewahrungsende, Aktion; „behalten“ nur mit Begründung),
// danach Antwort M15. Berichtigung je gefundener Bestellung (mit Rechnung: Gutschrift + neue Rechnung).

export interface ErasureRowView {
  key: string
  collection: string
  id: number
  area: string
  label: string
  ruleId: string
  until: string | null
  note: string
  actions: string[]
  suggested: string
}

const ACTION_LABEL: Record<string, AdminCustomKey> = {
  delete: 'privacyActionDelete',
  restrict: 'privacyActionRestrict',
  keep: 'privacyActionKeep',
  none: 'privacyActionNone',
}

export function PrivacyErasurePanel({ id, rows }: { id: number; rows: ErasureRowView[] }) {
  const router = useRouter()
  const [choice, setChoice] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.key, r.suggested])),
  )
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [notify, setNotify] = useState(true)
  const actionable = rows.filter((r) => r.actions.some((a) => a !== 'none'))
  const missingReason = actionable.some(
    (r) => choice[r.key] === 'keep' && (reasons[r.key] ?? '').trim().length < 10,
  )
  return (
    <div data-testid="privacy-erasure">
      <div
        className="pc-revenue__scroll"
        tabIndex={0}
        role="region"
        aria-label={adminText('privacyErasureTitle')}
      >
        <table className="pc-revenue__table">
          <thead>
            <tr>
              <th scope="col">{adminText('privacyErasureColRecord')}</th>
              <th scope="col">{adminText('privacyErasureColRule')}</th>
              <th scope="col">{adminText('privacyErasureColUntil')}</th>
              <th scope="col">{adminText('privacyErasureColAction')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.key}
                data-testid="privacy-erasure-row"
                data-collection={r.collection}
                data-id={r.id}
                data-suggested={r.suggested}
              >
                <th scope="row">
                  {adminText(`privacyArea_${r.area}` as AdminCustomKey)}: {r.label}
                </th>
                <td>
                  {r.ruleId}
                  <br />
                  <span className="pc-order__muted">{r.note}</span>
                </td>
                <td>{r.until ?? '–'}</td>
                <td>
                  {r.actions.length > 1 || r.actions[0] !== 'none' ? (
                    <select
                      aria-label={`${adminText('privacyErasureColAction')}: ${r.label}`}
                      value={choice[r.key]}
                      onChange={(e) => setChoice((o) => ({ ...o, [r.key]: e.target.value }))}
                      data-testid="privacy-erasure-action"
                    >
                      {[...new Set([...r.actions, 'none'])].map((a) => (
                        <option key={a} value={a}>
                          {adminText(ACTION_LABEL[a]!)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    adminText('privacyActionNone')
                  )}
                  {choice[r.key] === 'keep' ? (
                    <input
                      type="text"
                      maxLength={300}
                      aria-label={adminText('privacyErasureReason')}
                      placeholder={adminText('privacyErasureReason')}
                      value={reasons[r.key] ?? ''}
                      onChange={(e) => setReasons((o) => ({ ...o, [r.key]: e.target.value }))}
                      data-testid="privacy-erasure-reason"
                    />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <label className="pc-choice">
        <input
          type="checkbox"
          checked={notify}
          onChange={(e) => setNotify(e.target.checked)}
          data-testid="privacy-erasure-notify"
        />{' '}
        {adminText('privacyErasureNotify')}
      </label>
      <p className="pc-admin-row">
        <ActionButton
          variant="danger"
          effects={['delete']}
          disabled={actionable.length === 0 || missingReason}
          data-testid="privacy-erasure-apply"
          confirm={{
            title: adminText('privacyErasureConfirm'),
            consequence: adminText('privacyErasureConsequence'),
          }}
          action={async () => {
            const res = await postAdminAction<{ outcomes: unknown[] }>(
              `/api/privacy-requests/${id}/erasure`,
              {
                notify,
                decisions: rows.map((r) => ({
                  collection: r.collection,
                  id: r.id,
                  action: choice[r.key],
                  reason: reasons[r.key] ?? null,
                })),
              },
            )
            return { message: adminText('privacyErasureDone', { count: res.outcomes.length }) }
          }}
          onDone={() => router.refresh()}
        >
          {adminText('privacyErasureButton')}
        </ActionButton>
      </p>
    </div>
  )
}

export interface RectifyOrderView {
  id: number
  orderNumber: string
  name: string
  email: string
  street: string
  postalCode: string
  city: string
}

export function PrivacyRectifyPanel({ id, orders }: { id: number; orders: RectifyOrderView[] }) {
  const router = useRouter()
  const [orderId, setOrderId] = useState(orders[0]?.id ?? 0)
  const current = orders.find((o) => o.id === orderId) ?? orders[0]
  const [v, setV] = useState(() => ({
    name: current?.name ?? '',
    email: current?.email ?? '',
    street: current?.street ?? '',
    postalCode: current?.postalCode ?? '',
    city: current?.city ?? '',
  }))
  const pick = (oid: number) => {
    const o = orders.find((x) => x.id === oid)
    setOrderId(oid)
    if (o)
      setV({
        name: o.name,
        email: o.email,
        street: o.street,
        postalCode: o.postalCode,
        city: o.city,
      })
  }
  const field = (k: keyof typeof v, label: AdminCustomKey, type = 'text') => (
    <div className="pc-field">
      <label htmlFor={`rectify-${k}`} className="pc-field__label">
        {adminText(label)}
      </label>
      <input
        id={`rectify-${k}`}
        type={type}
        value={v[k]}
        onChange={(e) => setV((o) => ({ ...o, [k]: e.target.value }))}
        data-testid={`privacy-rectify-${k}`}
      />
    </div>
  )
  if (!current) return null
  return (
    <div data-testid="privacy-rectify">
      <div className="pc-field">
        <label htmlFor="rectify-order" className="pc-field__label">
          {adminText('privacyRectifyOrder')}
        </label>
        <select
          id="rectify-order"
          value={orderId}
          onChange={(e) => pick(Number(e.target.value))}
          data-testid="privacy-rectify-order"
        >
          {orders.map((o) => (
            <option key={o.id} value={o.id}>
              {o.orderNumber}
            </option>
          ))}
        </select>
      </div>
      {field('name', 'privacyRectifyName')}
      {field('email', 'privacyRectifyEmail', 'email')}
      {field('street', 'privacyRectifyStreet')}
      {field('postalCode', 'privacyRectifyPostalCode')}
      {field('city', 'privacyRectifyCity')}
      <p className="pc-admin-row">
        <ActionButton
          variant="secondary"
          data-testid="privacy-rectify-apply"
          confirm={{
            title: adminText('privacyRectifyConfirm'),
            consequence: adminText('privacyRectifyConsequence'),
          }}
          action={async () => {
            const body: Record<string, unknown> = { orderId }
            if (v.name !== current.name) body.customerName = v.name
            if (v.email !== current.email) body.customerEmail = v.email
            if (
              current.street !== '' &&
              (v.street !== current.street ||
                v.postalCode !== current.postalCode ||
                v.city !== current.city ||
                v.name !== current.name)
            ) {
              body.shippingAddress = {
                name: v.name,
                addressLine1: v.street,
                postalCode: v.postalCode,
                city: v.city,
              }
            }
            await postAdminAction(`/api/privacy-requests/${id}/rectify`, body)
            return { message: adminText('privacyRectifyDone') }
          }}
          onDone={() => router.refresh()}
        >
          {adminText('privacyRectifyButton')}
        </ActionButton>
      </p>
    </div>
  )
}
