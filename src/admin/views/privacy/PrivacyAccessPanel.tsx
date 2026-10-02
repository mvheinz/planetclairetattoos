'use client'

import { useRouter } from 'next/navigation'
import React, { useId, useState } from 'react'

import { ActionButton } from '../../components/ActionButton'
import { postAdminAction } from '../../components/adminAction'
import { adminText } from '../../translations'

// Personensuche und Auskunft (PLAN P6.17, LOESCHKONZEPT §5.4, R-150) in `/export/datenschutz/:id`: Suche nach E-Mail
// (vorbelegt mit der Adresse der Anfrage), Bestellnummer oder Name; „Export erstellen“ (ZIP mit daten.json,
// auskunft.html und Kopien der Bilder/Belege) zum Prüfen vor dem Versand; „Antwort senden“ (M14 mit Download-Link,
// nur an die gespeicherte Adresse, nur nach Identitätsprüfung).

export interface PrivacyAccessPanelProps {
  id: number
  contactEmail: string
  closed: boolean
  hasExport: boolean
  identityVerified: boolean
}

type Counts = Record<string, number>

export function PrivacyAccessPanel(p: PrivacyAccessPanelProps) {
  const router = useRouter()
  const base = useId()
  const [q, setQ] = useState({ email: p.contactEmail, orderNumber: '', name: '' })
  const [counts, setCounts] = useState<Counts | null>(null)
  const set = (k: keyof typeof q) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setQ((o) => ({ ...o, [k]: e.target.value }))
  const ready = q.email.trim() !== '' || q.orderNumber.trim() !== '' || q.name.trim() !== ''
  const body = {
    email: q.email.trim() || null,
    orderNumber: q.orderNumber.trim() || null,
    name: q.name.trim() || null,
  }
  const field = (k: keyof typeof q, label: string, type = 'text') => (
    <div className="pc-field">
      <label htmlFor={`${base}-${k}`} className="pc-field__label">
        {label}
      </label>
      <input
        id={`${base}-${k}`}
        type={type}
        value={q[k]}
        onChange={set(k)}
        data-testid={`privacy-search-${k}`}
      />
    </div>
  )
  return (
    <div data-testid="privacy-access">
      <p className="pc-order__muted">{adminText('privacySearchHint')}</p>
      {field('email', adminText('privacySearchEmail'), 'email')}
      {field('orderNumber', adminText('privacySearchOrder'))}
      {field('name', adminText('privacySearchName'))}
      <p className="pc-admin-row">
        <ActionButton
          variant="secondary"
          disabled={!ready}
          data-testid="privacy-search"
          action={async () => {
            const res = await postAdminAction<{ counts: Counts }>(
              `/api/privacy-requests/${p.id}/search`,
              body,
            )
            setCounts(res.counts)
            return { message: adminText('privacySearchDone') }
          }}
          onDone={() => router.refresh()}
        >
          {adminText('privacySearchButton')}
        </ActionButton>
        {!p.closed ? (
          <ActionButton
            disabled={!ready}
            data-testid="privacy-export"
            action={async () => {
              const res = await postAdminAction<{ counts: Counts }>(
                `/api/privacy-requests/${p.id}/export`,
                body,
              )
              setCounts(res.counts)
              return { message: adminText('privacyExportDone') }
            }}
            onDone={() => router.refresh()}
          >
            {adminText('privacyExportButton')}
          </ActionButton>
        ) : null}
      </p>
      {counts ? (
        <ul className="pc-order__list" data-testid="privacy-counts">
          {Object.entries(counts).map(([k, n]) => (
            <li key={k} data-area={k} data-count={n}>
              {adminText(`privacyArea_${k}` as Parameters<typeof adminText>[0])}: {n}
            </li>
          ))}
        </ul>
      ) : null}
      {p.hasExport && !p.closed ? (
        <p className="pc-admin-row">
          <ActionButton
            effects={['mail']}
            disabled={!p.identityVerified}
            data-testid="privacy-send-access"
            confirm={{
              title: adminText('privacySendAccessTitle'),
              consequence: adminText('privacySendAccessConsequence', { email: p.contactEmail }),
            }}
            action={() => postAdminAction(`/api/privacy-requests/${p.id}/send-access`)}
            onDone={() => router.refresh()}
          >
            {adminText('privacySendAccessButton')}
          </ActionButton>
        </p>
      ) : null}
      {p.hasExport && !p.identityVerified ? (
        <p className="pc-order__muted">{adminText('privacySendAccessIdentity')}</p>
      ) : null}
    </div>
  )
}
