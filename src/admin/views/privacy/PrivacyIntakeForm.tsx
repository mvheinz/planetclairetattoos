'use client'

import { useRouter } from 'next/navigation'
import React, { useId, useState } from 'react'

import { ActionButton } from '../../components/ActionButton'
import { postAdminAction } from '../../components/adminAction'
import { adminText } from '../../translations'

// „Anfrage erfassen“ in `/export/datenschutz` (PLAN P6.16, LOESCHKONZEPT §5.1): Art(en), Eingangsdatum (Tag des
// Zugangs, Standard heute), Kanal, E-Mail der Person, optional Name, Sprache der Antwort. Nummer und Frist vergibt der
// Server. Keine Art ist vorausgewählt.

type Option = { value: string; label: string }

export function PrivacyIntakeForm({
  today,
  types,
  channels,
  locales,
}: {
  today: string
  types: Option[]
  channels: Option[]
  locales: Option[]
}) {
  const router = useRouter()
  const base = useId()
  const [selected, setSelected] = useState<string[]>([])
  const [v, setV] = useState({
    receivedAt: today,
    channel: 'email',
    contactEmail: '',
    contactName: '',
    locale: 'de',
  })
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV((old) => ({ ...old, [k]: e.target.value }))
  const ready = selected.length > 0 && v.receivedAt !== '' && /\S+@\S+\.\S+/.test(v.contactEmail)
  const select = (k: 'channel' | 'locale', label: string, options: Option[]) => (
    <div className="pc-field">
      <label htmlFor={`${base}-${k}`} className="pc-field__label">
        {label}
      </label>
      <select id={`${base}-${k}`} value={v[k]} onChange={set(k)} data-testid={`privacy-${k}`}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )

  return (
    <details className="pc-order__section" data-testid="privacy-intake">
      <summary>{adminText('privacyIntakeTitle')}</summary>
      <p className="pc-order__muted">{adminText('privacyIntakeIntro')}</p>
      <fieldset className="pc-field">
        <legend className="pc-field__label">{adminText('privacyTypes')}</legend>
        {types.map((t) => (
          <label key={t.value} className="pc-choice">
            <input
              type="checkbox"
              checked={selected.includes(t.value)}
              onChange={(e) =>
                setSelected((old) =>
                  e.target.checked ? [...old, t.value] : old.filter((x) => x !== t.value),
                )
              }
              data-testid={`privacy-type-${t.value}`}
            />{' '}
            {t.label}
          </label>
        ))}
      </fieldset>
      <div className="pc-field">
        <label htmlFor={`${base}-receivedAt`} className="pc-field__label">
          {adminText('privacyReceivedAt')}
        </label>
        <input
          id={`${base}-receivedAt`}
          type="date"
          max={today}
          value={v.receivedAt}
          onChange={set('receivedAt')}
          data-testid="privacy-receivedAt"
        />
      </div>
      {select('channel', adminText('privacyChannel'), channels)}
      <div className="pc-field">
        <label htmlFor={`${base}-email`} className="pc-field__label">
          {adminText('privacyContactEmail')}
        </label>
        <input
          id={`${base}-email`}
          type="email"
          value={v.contactEmail}
          onChange={set('contactEmail')}
          data-testid="privacy-contactEmail"
        />
      </div>
      <div className="pc-field">
        <label htmlFor={`${base}-name`} className="pc-field__label">
          {adminText('privacyContactName')}
        </label>
        <input
          id={`${base}-name`}
          type="text"
          maxLength={100}
          value={v.contactName}
          onChange={set('contactName')}
          data-testid="privacy-contactName"
        />
      </div>
      {select('locale', adminText('privacyLocale'), locales)}
      <p className="pc-admin-row">
        <ActionButton
          data-testid="privacy-intake-submit"
          disabled={!ready}
          action={async () => {
            const res = await postAdminAction<{ doc: { reference: string } }>(
              '/api/privacy-requests/intake',
              { ...v, types: selected },
            )
            return { message: adminText('privacyIntakeCreated', { ref: res.doc.reference }) }
          }}
          onDone={() => router.refresh()}
        >
          {adminText('privacyIntakeButton')}
        </ActionButton>
      </p>
    </details>
  )
}
