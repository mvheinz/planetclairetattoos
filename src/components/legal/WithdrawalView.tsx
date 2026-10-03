import React from 'react'

import { FormAlert } from '@/components/forms/FormAlert'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Choice'
import { Field, type FieldProps, RequiredNote } from '@/components/ui/Field'
import type de from '@/i18n/messages/de.json'
import type { WithdrawalFlowState, WithdrawalNotice } from '@/lib/legal/withdrawalForm'

import { WithdrawalLive } from './WithdrawalClient'
import styles from './WithdrawalFlow.module.css'
import { WithdrawalPrintButton } from './WithdrawalPrintButton'

// Inhalt der Schritte der Widerrufsfunktion R26 (PLAN P6.8): je Schritt der Teil vor dem Formular (`pre`: Überschrift,
// Hinweise, Zusammenfassung bzw. Ergebnis) und der Inhalt des `<form>` (`form`). Ohne Hooks und ohne `'use client'`:
// Die Erstansicht rendert der Server (Seite R26) – sie kostet so kein JS beim ersten Laden (Budget firstLoadJs,
// tests/perf/budgets.json); jeden weiteren Zustand (Fehler, Auswahl, Bestätigung, Ergebnis) rendert `WithdrawalFlow` im
// Browser mit diesem Modul, das es nach dem `load`-Ereignis nachlädt. Das `<form>` selbst samt Server Action liegt in
// `WithdrawalFlow`.

export type WithdrawalMessages = (typeof de)['withdraw']

/** Feste Angaben der Seite (ohne Zustand). */
export interface WithdrawalViewFlow {
  locale: 'de' | 'en'
  messages: WithdrawalMessages
  confirmLabel: string
  privacyHref: string
  contactEmail: string | null
}

export interface WithdrawalViewProps {
  part: 'pre' | 'form'
  state: WithdrawalFlowState
  flow: WithdrawalViewFlow
  /** Überschrift des Schritts (Fokus nach jedem Schritt; nur im Browser gesetzt). */
  headingRef?: (el: HTMLHeadingElement | null) => void
}

const FIELD_ORDER = ['name', 'contractIdentification', 'email', 'itemsText', 'reason'] as const
type FieldKey = (typeof FIELD_ORDER)[number]

// Eingabe-Eigenschaften je Feld (Reihenfolge = FIELD_ORDER).
const FIELD_PROPS: Record<FieldKey, Partial<FieldProps>> = {
  name: { required: true, autoComplete: 'name', maxLength: 100 },
  contractIdentification: { required: true, multiline: true, rows: 3, maxLength: 500 },
  email: { required: true, type: 'email', autoComplete: 'email', maxLength: 254 },
  itemsText: { multiline: true, rows: 3, maxLength: 1000 },
  reason: { multiline: true, rows: 4, maxLength: 2000 },
}

export function WithdrawalView({ part, state, flow, headingRef }: WithdrawalViewProps) {
  const { locale, messages: m } = flow

  const noticeText = (n: WithdrawalNotice | undefined) =>
    n === 'rate_limited'
      ? m.noticeRateLimited
      : n === 'expired'
        ? m.noticeExpired
        : n === 'failed'
          ? m.noticeFailed
          : null

  const label: Record<FieldKey, string> = {
    name: m.nameLabel,
    contractIdentification: m.contractLabel,
    email: m.emailLabel,
    itemsText: m.itemsTextLabel,
    reason: m.reasonLabel,
  }
  const hint: Partial<Record<FieldKey, string>> = {
    contractIdentification: m.contractHint,
    email: m.emailHint,
    itemsText: m.itemsTextHint,
    reason: m.reasonHint,
  }

  const hidden = (stage: string) => (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="stage" value={stage} />
    </>
  )

  const notice = 'notice' in state ? noticeText(state.notice) : null
  const noticeBox = notice ? (
    <FormAlert data={{ 'data-withdraw-notice': '' }}>
      {notice}
      {flow.contactEmail ? (
        <>
          {' '}
          <a href={`mailto:${flow.contactEmail}`}>{flow.contactEmail}</a>
        </>
      ) : null}
    </FormAlert>
  ) : null

  // Zusammenfassung (Schritt 2 und Bestätigung): Angaben in Formular-Reihenfolge, Stücke nur, wenn bekannt.
  const summaryRows = (
    d: {
      name: string
      contractIdentification: string
      email: string
      itemsText?: string | null
      reason?: string | null
    },
    items: React.ReactNode,
  ) => (
    <>
      <dt>{m.nameLabel}</dt>
      <dd>{d.name}</dd>
      <dt>{m.contractLabel}</dt>
      <dd>{d.contractIdentification}</dd>
      <dt>{m.emailLabel}</dt>
      <dd>{d.email}</dd>
      {items ? (
        <>
          <dt>{m.summaryItems}</dt>
          <dd>{items}</dd>
        </>
      ) : null}
      <dt>{m.itemsTextLabel}</dt>
      <dd>{d.itemsText?.trim() || m.summaryEmpty}</dd>
      <dt>{m.reasonLabel}</dt>
      <dd>{d.reason?.trim() || m.summaryEmpty}</dd>
    </>
  )

  const heading = (text: string) => (
    <h2 ref={headingRef} tabIndex={-1} className={styles.stepTitle} data-withdraw-step-title="">
      {text}
    </h2>
  )

  const list = (items: string[]) => (
    <ul>
      {items.map((l) => (
        <li key={l}>{l}</li>
      ))}
    </ul>
  )

  if (state.step === 'form') {
    const errors = state.errors ?? {}
    const errorKeys = FIELD_ORDER.filter((k) => errors[k])
    const errorText = (k: FieldKey) =>
      errors[k] === 'required' ? m.errorRequired : k === 'email' ? m.errorEmail : m.errorInvalid
    if (part === 'pre')
      return (
        <>
          {heading(m.stepForm)}
          {noticeBox}
          {errorKeys.length > 0 ? (
            <FormAlert
              data={{ 'data-error-summary': '' }}
              title={m.errorSummary}
              links={errorKeys.map((k) => ({
                href: `#widerruf-${k}`,
                text: `${label[k]}: ${errorText(k)}`,
              }))}
            />
          ) : null}
        </>
      )
    const v = state.values
    return (
      <>
        {hidden('form')}
        <RequiredNote>{m.requiredNote}</RequiredNote>
        {FIELD_ORDER.map((k) => (
          <Field
            key={k}
            id={`widerruf-${k}`}
            name={k}
            label={label[k]}
            hint={hint[k]}
            defaultValue={v[k]}
            error={errors[k] ? errorText(k) : undefined}
            {...FIELD_PROPS[k]}
          />
        ))}
        <div className={styles.honeypot} aria-hidden="true">
          <label htmlFor="widerruf-website">{m.honeypotLabel}</label>
          <input
            id="widerruf-website"
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            defaultValue=""
          />
        </div>
        <p className={styles.small} data-withdraw-privacy="">
          {m.privacy.split('{link}')[0]}
          <a href={flow.privacyHref}>{m.privacyLink}</a>
          {m.privacy.split('{link}')[1]}
        </p>
        <div className={styles.actions}>
          <Button type="submit" name="intent" value="next">
            {m.next}
          </Button>
        </div>
        <WithdrawalLive text={m.busy} />
      </>
    )
  }

  if (state.step === 'select') {
    if (part === 'pre')
      return (
        <>
          {heading(m.stepSelect)}
          <p>{m.selectIntro}</p>
        </>
      )
    return (
      <>
        {hidden('select')}
        <input type="hidden" name="token" value={state.token} />
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>{m.selectLegend}</legend>
          {state.choices.map((c, i) => (
            <Checkbox
              key={c.id}
              id={`widerruf-position-${i}`}
              name="affectedItemIds"
              value={c.id}
              label={c.label}
            />
          ))}
        </fieldset>
        <p className={styles.small} data-withdraw-whole="">
          {m.selectWhole}
        </p>
        <div className={styles.actions}>
          <Button type="submit" name="intent" value="edit" variant="secondary">
            {m.edit}
          </Button>
          <Button type="submit" name="intent" value="next">
            {m.next}
          </Button>
        </div>
      </>
    )
  }

  if (state.step === 'confirm') {
    if (part === 'pre') {
      const items = state.selectedLabels.length > 0 ? state.selectedLabels : null
      return (
        <>
          {heading(m.stepConfirm)}
          {noticeBox}
          <p>{m.confirmIntro}</p>
          <dl className={styles.summary} data-withdraw-summary="">
            {summaryRows(
              state.values,
              state.matched ? (items ? list(items) : m.summaryWhole) : null,
            )}
          </dl>
        </>
      )
    }
    return (
      <>
        {hidden('confirm')}
        <input type="hidden" name="token" value={state.token} />
        <div className={styles.actions}>
          <Button type="submit" name="intent" value="edit" variant="secondary">
            {m.edit}
          </Button>
          <Button type="submit" name="intent" value="confirm">
            {flow.confirmLabel}
          </Button>
        </div>
        <WithdrawalLive text={m.busy} />
      </>
    )
  }

  if (part === 'form') return null
  const r = state.receipt
  return (
    <>
      {heading(m.stepDone)}
      {r ? (
        <>
          <dl className={styles.summary} data-withdraw-receipt="">
            <dt>{m.reference}</dt>
            <dd data-withdraw-reference="">{r.reference}</dd>
            <dt>{m.receivedAt}</dt>
            <dd data-withdraw-received-at="">{r.receivedAtText}</dd>
            {summaryRows(r, state.itemLabels.length > 0 ? list(state.itemLabels) : null)}
          </dl>
          {r.unpaidOrderCancelled ? <p data-withdraw-unpaid="">{m.unpaidCancelled}</p> : null}
          <p data-withdraw-mail-note="">{m.mailNote}</p>
          <p className={styles.small}>{m.printNote}</p>
          <p className="u-no-print">
            <WithdrawalPrintButton label={m.print} />
          </p>
        </>
      ) : (
        <p>{m.spamDone}</p>
      )}
    </>
  )
}
