'use client'

import React, { useActionState, useEffect, useRef } from 'react'

import { withdrawalAction } from '@/app/(frontend)/[locale]/withdraw-from-contract/actions'
import { Icon } from '@/components/icons/Icon'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Choice'
import { Field, RequiredNote } from '@/components/ui/Field'
import type de from '@/i18n/messages/de.json'
import type { WithdrawalFlowState, WithdrawalNotice } from '@/lib/legal/withdrawalForm'
import { formatItemNumber } from '@/lib/products/itemNumber'

import styles from './WithdrawalFlow.module.css'

// Widerrufsfunktion R26 (PLAN P6.8, KONZEPT §3.16, DESIGN KO-12, § 356a BGB): Schritt 1 (Erklärung) → ggf. Auswahl der
// Stücke (Checkboxen, keine vorangekreuzt; nichts angehakt = ganzer Vertrag) → Schritt 2 (Zusammenfassung, „Ändern“,
// „Widerruf bestätigen“) → Ergebnis mit allen Angaben, Eingang (Europe/Berlin), Vorgangsnummer und Druckhinweis.
// `useActionState` mit einer Server Action: ohne JavaScript ein normales POST-Formular, dessen Antwort den nächsten
// Schritt rendert. Eingaben reisen zwischen den Schritten nur im signierten Formular-Token (POST), nie in der URL.
// Kein CAPTCHA; ein unsichtbarer Honeypot (`website`).

export type WithdrawalMessages = (typeof de)['withdraw']

export interface WithdrawalFlowProps {
  locale: 'de' | 'en'
  messages: WithdrawalMessages
  confirmLabel: string
  privacyHref: string
  contactEmail: string | null
  initial: WithdrawalFlowState
}

const FIELD_ORDER = ['name', 'contractIdentification', 'email', 'itemsText', 'reason'] as const
type FieldKey = (typeof FIELD_ORDER)[number]

function NoticeBox({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.notice} role="alert" data-withdraw-notice="">
      <Icon name="warn" size={22} className={styles.noticeIcon} />
      <div>{children}</div>
    </div>
  )
}

export function WithdrawalFlow(props: WithdrawalFlowProps) {
  const { locale, messages: m } = props
  const [state, dispatch, pending] = useActionState(withdrawalAction, props.initial)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const first = useRef(true)

  // Nach jedem Schritt: Fokus auf die Überschrift (Tastatur/Screenreader); im Ergebnis die URL ohne Abfrage (R-137).
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    headingRef.current?.focus()
    if (state.step === 'done' && window.location.search) {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [state])

  // Ein Absenden zur Zeit (Doppelklick); ohne JavaScript schützt die Einmal-Kennung im Token (ein Datensatz).
  const guard = (e: React.FormEvent<HTMLFormElement>) => {
    if (pending) e.preventDefault()
  }

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

  const hidden = (stage: string) => (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="stage" value={stage} />
    </>
  )

  const contact = props.contactEmail ? (
    <>
      {' '}
      <a href={`mailto:${props.contactEmail}`}>{props.contactEmail}</a>
    </>
  ) : null

  const heading = (text: string) => (
    <h2 ref={headingRef} tabIndex={-1} className={styles.stepTitle} data-withdraw-step-title="">
      {text}
    </h2>
  )

  if (state.step === 'form') {
    const errors = state.errors ?? {}
    const errorKeys = FIELD_ORDER.filter((k) => errors[k])
    const errorText = (k: FieldKey) =>
      errors[k] === 'required' ? m.errorRequired : k === 'email' ? m.errorEmail : m.errorInvalid
    const v = state.values
    const notice = noticeText(state.notice)
    return (
      <section className={styles.step} data-withdraw-step="form" key={`form-${state.rev}`}>
        {heading(m.stepForm)}
        {notice ? (
          <NoticeBox>
            {notice}
            {contact}
          </NoticeBox>
        ) : null}
        {errorKeys.length > 0 ? (
          <div className={styles.notice} role="alert" data-error-summary="">
            <Icon name="warn" size={22} className={styles.noticeIcon} />
            <div>
              <p className={styles.noticeTitle}>{m.errorSummary}</p>
              <ul>
                {errorKeys.map((k) => (
                  <li key={k}>
                    <a href={`#widerruf-${k}`}>
                      {label[k]}: {errorText(k)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
        <form
          action={dispatch}
          onSubmit={guard}
          className={styles.form}
          noValidate
          data-withdraw-form=""
        >
          {hidden('form')}
          <RequiredNote>{m.requiredNote}</RequiredNote>
          <Field
            id="widerruf-name"
            name="name"
            label={m.nameLabel}
            required
            autoComplete="name"
            maxLength={100}
            defaultValue={v.name}
            error={errors.name ? errorText('name') : undefined}
          />
          <Field
            id="widerruf-contractIdentification"
            name="contractIdentification"
            label={m.contractLabel}
            hint={m.contractHint}
            required
            multiline
            rows={3}
            maxLength={500}
            defaultValue={v.contractIdentification}
            error={errors.contractIdentification ? errorText('contractIdentification') : undefined}
          />
          <Field
            id="widerruf-email"
            name="email"
            type="email"
            label={m.emailLabel}
            hint={m.emailHint}
            required
            autoComplete="email"
            maxLength={254}
            defaultValue={v.email}
            error={errors.email ? errorText('email') : undefined}
          />
          <Field
            id="widerruf-itemsText"
            name="itemsText"
            label={m.itemsTextLabel}
            hint={m.itemsTextHint}
            multiline
            rows={3}
            maxLength={1000}
            defaultValue={v.itemsText}
            error={errors.itemsText ? errorText('itemsText') : undefined}
          />
          <Field
            id="widerruf-reason"
            name="reason"
            label={m.reasonLabel}
            hint={m.reasonHint}
            multiline
            rows={4}
            maxLength={2000}
            defaultValue={v.reason}
            error={errors.reason ? errorText('reason') : undefined}
          />
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
            <a href={props.privacyHref}>{m.privacyLink}</a>
            {m.privacy.split('{link}')[1]}
          </p>
          <div className={styles.actions}>
            <Button type="submit" name="intent" value="next" ariaDisabled={pending}>
              {m.next}
            </Button>
          </div>
          <p className={styles.live} aria-live="polite">
            {pending ? m.busy : ''}
          </p>
        </form>
      </section>
    )
  }

  if (state.step === 'select') {
    return (
      <section className={styles.step} data-withdraw-step="select" key={`select-${state.rev}`}>
        {heading(m.stepSelect)}
        <p>{m.selectIntro}</p>
        <form action={dispatch} onSubmit={guard} className={styles.form} data-withdraw-form="">
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
            <Button type="submit" name="intent" value="next" ariaDisabled={pending}>
              {m.next}
            </Button>
          </div>
        </form>
      </section>
    )
  }

  if (state.step === 'confirm') {
    const v = state.values
    const notice = noticeText(state.notice)
    const items = state.selectedLabels.length > 0 ? state.selectedLabels : null
    return (
      <section className={styles.step} data-withdraw-step="confirm" key={`confirm-${state.rev}`}>
        {heading(m.stepConfirm)}
        {notice ? (
          <NoticeBox>
            {notice}
            {contact}
          </NoticeBox>
        ) : null}
        <p>{m.confirmIntro}</p>
        <dl className={styles.summary} data-withdraw-summary="">
          <dt>{m.nameLabel}</dt>
          <dd>{v.name}</dd>
          <dt>{m.contractLabel}</dt>
          <dd>{v.contractIdentification}</dd>
          <dt>{m.emailLabel}</dt>
          <dd>{v.email}</dd>
          {state.matched ? (
            <>
              <dt>{m.summaryItems}</dt>
              <dd>
                {items ? (
                  <ul>
                    {items.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                ) : (
                  m.summaryWhole
                )}
              </dd>
            </>
          ) : null}
          <dt>{m.itemsTextLabel}</dt>
          <dd>{v.itemsText.trim() || m.summaryEmpty}</dd>
          <dt>{m.reasonLabel}</dt>
          <dd>{v.reason.trim() || m.summaryEmpty}</dd>
        </dl>
        <form action={dispatch} onSubmit={guard} className={styles.form} data-withdraw-form="">
          {hidden('confirm')}
          <input type="hidden" name="token" value={state.token} />
          <div className={styles.actions}>
            <Button type="submit" name="intent" value="edit" variant="secondary">
              {m.edit}
            </Button>
            <Button type="submit" name="intent" value="confirm" ariaDisabled={pending}>
              {props.confirmLabel}
            </Button>
          </div>
          <p className={styles.live} aria-live="polite">
            {pending ? m.busy : ''}
          </p>
        </form>
      </section>
    )
  }

  const r = state.receipt
  return (
    <section className={styles.step} data-withdraw-step="done" key={`done-${state.rev}`}>
      {heading(m.stepDone)}
      {r ? (
        <>
          <dl className={styles.summary} data-withdraw-receipt="">
            <dt>{m.reference}</dt>
            <dd data-withdraw-reference="">{r.reference}</dd>
            <dt>{m.receivedAt}</dt>
            <dd data-withdraw-received-at="">{r.receivedAtText}</dd>
            <dt>{m.nameLabel}</dt>
            <dd>{r.name}</dd>
            <dt>{m.contractLabel}</dt>
            <dd>{r.contractIdentification}</dd>
            <dt>{m.emailLabel}</dt>
            <dd>{r.email}</dd>
            {r.items.length > 0 ? (
              <>
                <dt>{m.summaryItems}</dt>
                <dd>
                  <ul>
                    {r.items.map((i) => (
                      <li key={i.itemNumber}>
                        {formatItemNumber(i.itemNumber, locale)} · {i.title}
                      </li>
                    ))}
                  </ul>
                </dd>
              </>
            ) : null}
            <dt>{m.itemsTextLabel}</dt>
            <dd>{r.itemsText?.trim() || m.summaryEmpty}</dd>
            <dt>{m.reasonLabel}</dt>
            <dd>{r.reason?.trim() || m.summaryEmpty}</dd>
          </dl>
          {r.unpaidOrderCancelled ? <p data-withdraw-unpaid="">{m.unpaidCancelled}</p> : null}
          <p data-withdraw-mail-note="">{m.mailNote}</p>
          <p className={styles.small}>{m.printNote}</p>
          <p className="u-no-print">
            <Button variant="secondary" onClick={() => window.print()}>
              {m.print}
            </Button>
          </p>
        </>
      ) : (
        <p>{m.spamDone}</p>
      )}
    </section>
  )
}
