'use client'

import { useRouter } from 'next/navigation'
import React, { useId, useState } from 'react'

import { ActionButton } from '../../components/ActionButton'
import { postAdminAction } from '../../components/adminAction'
import { adminText } from '../../translations'

// Bearbeiten einer Datenschutz-Anfrage `/export/datenschutz/:id` (PLAN P6.16, LOESCHKONZEPT §5.2, §5.3, §5.11):
// Statuswechsel (nur erlaubte Übergänge), Identität geprüft + Prüfart, Verlängerung (neue Frist ≤ Eingang + 3 Monate,
// Grund, Tag der Mitteilung im ersten Monat), Abschluss mit Antwortdatum und Ergebnis (Pflicht bei „abgelehnt“, auch
// das Prüfergebnis eines Widerspruchs nach Art. 21). Der Server prüft alles noch einmal.

type Option = { value: string; label: string }

export interface PrivacyRequestEditorProps {
  id: number
  status: string
  transitions: Option[]
  identityVerified: boolean
  identityMethod: string | null
  identityMethods: Option[]
  extendedDueAt: string | null
  extensionReason: string | null
  extensionNotifiedAt: string | null
  maxExtendedDueAt: string
  answeredAt: string | null
  resultNote: string | null
  today: string
}

const save = (id: number, body: Record<string, unknown>) =>
  postAdminAction(`/api/privacy-requests/${id}/save`, body)

export function PrivacyRequestEditor(p: PrivacyRequestEditorProps) {
  const router = useRouter()
  const base = useId()
  const refresh = () => router.refresh()
  const [identity, setIdentity] = useState({
    verified: p.identityVerified,
    method: p.identityMethod ?? '',
  })
  const [ext, setExt] = useState({
    extendedDueAt: p.extendedDueAt ?? '',
    extensionReason: p.extensionReason ?? '',
    extensionNotifiedAt: p.extensionNotifiedAt ?? '',
  })
  const [close, setClose] = useState({
    answeredAt: p.answeredAt ?? p.today,
    resultNote: p.resultNote ?? '',
  })
  const closing = p.transitions.filter((t) => t.value === 'answered' || t.value === 'rejected')
  const moving = p.transitions.filter((t) => t.value !== 'answered' && t.value !== 'rejected')

  return (
    <>
      <section className="pc-order__section" aria-labelledby={`${base}-status`}>
        <h2 id={`${base}-status`}>{adminText('privacyStatusTitle')}</h2>
        {moving.length > 0 ? (
          <p className="pc-admin-row">
            {moving.map((t) => (
              <ActionButton
                key={t.value}
                variant="secondary"
                data-testid={`privacy-status-${t.value}`}
                action={() => save(p.id, { status: t.value })}
                onDone={refresh}
              >
                {adminText('privacyStatusTo', { status: t.label })}
              </ActionButton>
            ))}
          </p>
        ) : (
          <p className="pc-order__muted">{adminText('privacyStatusNone')}</p>
        )}
      </section>

      <section className="pc-order__section" aria-labelledby={`${base}-identity`}>
        <h2 id={`${base}-identity`}>{adminText('privacyIdentityTitle')}</h2>
        <p className="pc-order__muted">{adminText('privacyIdentityHint')}</p>
        <label className="pc-choice">
          <input
            type="checkbox"
            checked={identity.verified}
            onChange={(e) => setIdentity((o) => ({ ...o, verified: e.target.checked }))}
            data-testid="privacy-identity-verified"
          />{' '}
          {adminText('privacyIdentityVerified')}
        </label>
        <div className="pc-field">
          <label htmlFor={`${base}-method`} className="pc-field__label">
            {adminText('privacyIdentityMethod')}
          </label>
          <select
            id={`${base}-method`}
            value={identity.method}
            onChange={(e) => setIdentity((o) => ({ ...o, method: e.target.value }))}
            data-testid="privacy-identity-method"
          >
            <option value="">–</option>
            {p.identityMethods.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <p className="pc-admin-row">
          <ActionButton
            variant="secondary"
            data-testid="privacy-identity-save"
            disabled={identity.verified && identity.method === ''}
            action={() =>
              save(p.id, {
                identityVerified: identity.verified,
                identityMethod: identity.method || null,
              })
            }
            onDone={refresh}
          >
            {adminText('privacySave')}
          </ActionButton>
        </p>
      </section>

      <details className="pc-order__section" data-testid="privacy-extension">
        <summary>{adminText('privacyExtensionTitle')}</summary>
        <p className="pc-order__muted">{adminText('privacyExtensionHint')}</p>
        <div className="pc-field">
          <label htmlFor={`${base}-ext`} className="pc-field__label">
            {adminText('privacyExtendedDueAt')}
          </label>
          <input
            id={`${base}-ext`}
            type="date"
            max={p.maxExtendedDueAt}
            value={ext.extendedDueAt}
            onChange={(e) => setExt((o) => ({ ...o, extendedDueAt: e.target.value }))}
            data-testid="privacy-extendedDueAt"
          />
        </div>
        <div className="pc-field">
          <label htmlFor={`${base}-reason`} className="pc-field__label">
            {adminText('privacyExtensionReason')}
          </label>
          <input
            id={`${base}-reason`}
            type="text"
            maxLength={300}
            value={ext.extensionReason}
            onChange={(e) => setExt((o) => ({ ...o, extensionReason: e.target.value }))}
            data-testid="privacy-extensionReason"
          />
        </div>
        <div className="pc-field">
          <label htmlFor={`${base}-notified`} className="pc-field__label">
            {adminText('privacyExtensionNotifiedAt')}
          </label>
          <input
            id={`${base}-notified`}
            type="date"
            max={p.today}
            value={ext.extensionNotifiedAt}
            onChange={(e) => setExt((o) => ({ ...o, extensionNotifiedAt: e.target.value }))}
            data-testid="privacy-extensionNotifiedAt"
          />
        </div>
        <p className="pc-admin-row">
          <ActionButton
            variant="secondary"
            data-testid="privacy-extension-save"
            action={() =>
              save(p.id, {
                extendedDueAt: ext.extendedDueAt || null,
                extensionReason: ext.extensionReason || null,
                extensionNotifiedAt: ext.extensionNotifiedAt || null,
              })
            }
            onDone={refresh}
          >
            {adminText('privacySave')}
          </ActionButton>
        </p>
      </details>

      {closing.length > 0 ? (
        <section className="pc-order__section" aria-labelledby={`${base}-close`}>
          <h2 id={`${base}-close`}>{adminText('privacyCloseTitle')}</h2>
          <p className="pc-order__muted">{adminText('privacyCloseHint')}</p>
          <div className="pc-field">
            <label htmlFor={`${base}-answered`} className="pc-field__label">
              {adminText('privacyAnsweredAt')}
            </label>
            <input
              id={`${base}-answered`}
              type="date"
              max={p.today}
              value={close.answeredAt}
              onChange={(e) => setClose((o) => ({ ...o, answeredAt: e.target.value }))}
              data-testid="privacy-answeredAt"
            />
          </div>
          <div className="pc-field">
            <label htmlFor={`${base}-result`} className="pc-field__label">
              {adminText('privacyResultNote')}
            </label>
            <textarea
              id={`${base}-result`}
              maxLength={2000}
              rows={4}
              value={close.resultNote}
              onChange={(e) => setClose((o) => ({ ...o, resultNote: e.target.value }))}
              data-testid="privacy-resultNote"
            />
          </div>
          <p className="pc-admin-row">
            {closing.map((t) => (
              <ActionButton
                key={t.value}
                variant={t.value === 'rejected' ? 'danger' : 'primary'}
                data-testid={`privacy-close-${t.value}`}
                confirm={{
                  title: adminText('privacyStatusTo', { status: t.label }),
                  consequence: adminText('privacyCloseConsequence'),
                }}
                action={() =>
                  save(p.id, {
                    status: t.value,
                    answeredAt: close.answeredAt,
                    resultNote: close.resultNote || null,
                  })
                }
                onDone={refresh}
              >
                {adminText('privacyStatusTo', { status: t.label })}
              </ActionButton>
            ))}
          </p>
        </section>
      ) : null}
    </>
  )
}
