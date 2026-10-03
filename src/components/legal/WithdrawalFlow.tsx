'use client'

import React, { lazy, useActionState, useCallback, useEffect, useRef } from 'react'

import { withdrawalAction } from '@/app/(frontend)/[locale]/withdraw-from-contract/actions'
import { afterLoad } from '@/components/forms/afterLoad'
import { Button } from '@/components/ui/Button'
import { Field, type FieldProps, RequiredNote } from '@/components/ui/Field'
import type de from '@/i18n/messages/de.json'
import type { WithdrawalFlowState, WithdrawalNotice } from '@/lib/legal/withdrawalForm'

import styles from './WithdrawalFlow.module.css'
import type { WithdrawalStepContext } from './WithdrawalSteps'

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

// Eingabe-Eigenschaften je Feld (Reihenfolge = FIELD_ORDER); als Tabelle statt fünf ausgeschriebener `<Field>` – hält
// den Client-Chunk von R26 im Budget (firstLoadJs, tests/perf/budgets.json).
const FIELD_PROPS: Record<FieldKey, Partial<FieldProps>> = {
  name: { required: true, autoComplete: 'name', maxLength: 100 },
  contractIdentification: { required: true, multiline: true, rows: 3, maxLength: 500 },
  email: { required: true, type: 'email', autoComplete: 'email', maxLength: 254 },
  itemsText: { multiline: true, rows: 3, maxLength: 1000 },
  reason: { multiline: true, rows: 4, maxLength: 2000 },
}

// Spätere Schritte (Auswahl, Bestätigung, Ergebnis) als eigenes Modul – nicht im JS beim ersten Laden (siehe
// WithdrawalSteps.tsx); nach `load` im Leerlauf vorgeladen, damit der Schritt beim Absenden sofort da ist. `React.lazy`
// statt `next/dynamic` (dessen Laufzeit kostet selbst gut 2 KB gz); der Server rendert den Schritt trotzdem (ohne JS).
const loadSteps = () => import('./WithdrawalSteps')
const WithdrawalSteps = lazy(() => loadSteps().then((mod) => ({ default: mod.WithdrawalSteps })))

// Hinweise und Fehlerzusammenfassung gibt es erst nach dem Absenden – ebenfalls nachgeladen.
const loadAlert = () => import('@/components/forms/FormAlert')
const FormAlert = lazy(loadAlert)

function NoticeBox({ children }: { children: React.ReactNode }) {
  return <FormAlert data={{ 'data-withdraw-notice': '' }}>{children}</FormAlert>
}

export function WithdrawalFlow(props: WithdrawalFlowProps) {
  const { locale, messages: m } = props
  const [state, dispatch, pending] = useActionState(withdrawalAction, props.initial)
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const focusDue = useRef(false)
  const first = useRef(true)

  useEffect(() => afterLoad(() => void Promise.all([loadSteps(), loadAlert()])), [])

  // Überschrift des aktuellen Schritts; wird sie erst nach dem Nachladen des Schritts eingehängt, bekommt sie dann den
  // Fokus.
  const headingCallback = useCallback((el: HTMLHeadingElement | null) => {
    headingRef.current = el
    if (el && focusDue.current) {
      focusDue.current = false
      el.focus()
    }
  }, [])

  // Nach jedem Schritt: Fokus auf die Überschrift (Tastatur/Screenreader); im Ergebnis die URL ohne Abfrage (R-137).
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (headingRef.current) headingRef.current.focus()
    else focusDue.current = true
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

  const contact = props.contactEmail ? (
    <>
      {' '}
      <a href={`mailto:${props.contactEmail}`}>{props.contactEmail}</a>
    </>
  ) : null

  const heading = (text: string) => (
    <h2
      ref={headingCallback}
      tabIndex={-1}
      className={styles.stepTitle}
      data-withdraw-step-title=""
    >
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
          <FormAlert
            data={{ 'data-error-summary': '' }}
            title={m.errorSummary}
            links={errorKeys.map((k) => ({
              href: `#widerruf-${k}`,
              text: `${label[k]}: ${errorText(k)}`,
            }))}
          />
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

  const ctx: WithdrawalStepContext = {
    m,
    confirmLabel: props.confirmLabel,
    contact,
    dispatch,
    pending,
    guard,
    heading,
    hidden,
    noticeText,
    NoticeBox,
  }
  // Ohne eigene Suspense-Grenze: Der Server wartet mit der Seite auf den Schritt (ohne JavaScript sofort im HTML);
  // im Browser bleibt beim Absenden der alte Schritt stehen, bis der neue geladen ist (Übergang).
  return <WithdrawalSteps state={state} ctx={ctx} />
}
