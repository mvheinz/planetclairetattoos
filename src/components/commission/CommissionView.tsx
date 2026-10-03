import React from 'react'

import { FormAlert } from '@/components/forms/FormAlert'
import { Button } from '@/components/ui/Button'
import { Field, RequiredNote, Select } from '@/components/ui/Field'
import type de from '@/i18n/messages/de.json'
import type { CommissionFormState, CommissionNotice } from '@/lib/commission/form'
import type { CommissionField } from '@/lib/commission/submit'

import styles from './Commission.module.css'
import { CommissionLive, ImagesSlot, ObjectTypeWatch, OtherFieldGate } from './CommissionClient'

// Inhalt des Formulars Auftragsarbeiten R10 (PLAN P7.13, KONZEPT §10, DESIGN KO-12): `messages` (Hinweis bzw.
// Fehlerzusammenfassung mit Sprunglinks über dem Formular) und `fields` (Felder, Bilder, Honeypot, Absenden,
// Datenschutzhinweis). Ohne Hooks und ohne `'use client'`: Die Erstansicht rendert der Server (Block
// `CommissionFormBlock`) – sie kostet so kein JS beim ersten Laden (Budget firstLoadJs, tests/perf/budgets.json); jeden
// weiteren Zustand rendert `CommissionForm` im Browser mit diesem Modul (nach dem `load`-Ereignis vorgeladen). Die
// beweglichen Teile (Auswahl „Etwas anderes“, Bilder, Statuszeile) sind kleine Client-Komponenten (CommissionClient.tsx).

export type CommissionFormMessages = (typeof de)['commission']['form']

/** Feste Angaben des Blocks (ohne Zustand). */
export interface CommissionViewFlow {
  locale: 'de' | 'en'
  messages: CommissionFormMessages
  privacyNotice: string
  privacyHref: string
  contactEmail: string | null
}

type FormState = Extract<CommissionFormState, { step: 'form' }>

const FIELD_ORDER: readonly CommissionField[] = [
  'name',
  'email',
  'objectType',
  'objectTypeOther',
  'idea',
  'desiredTimeframe',
  'budget',
]

export function CommissionView({
  part,
  state,
  flow,
}: {
  part: 'messages' | 'fields'
  state: FormState
  flow: CommissionViewFlow
}) {
  const { messages: m } = flow
  const errors = state.errors ?? {}
  const errorText = (k: CommissionField) =>
    errors[k] === 'required' && k !== 'objectTypeOther' ? m.errors.required : m.errors[k]

  if (part === 'messages') {
    const errorKeys = FIELD_ORDER.filter((k) => errors[k])
    const labels: Record<CommissionField, string> = {
      name: m.nameLabel,
      email: m.emailLabel,
      objectType: m.objectTypeLabel,
      objectTypeOther: m.objectTypeOtherLabel,
      idea: m.ideaLabel,
      desiredTimeframe: m.timeframeLabel,
      budget: m.budgetLabel,
    }
    const notice: Record<CommissionNotice, string> = {
      rate_limited: m.noticeRateLimited,
      expired: m.noticeExpired,
      failed: m.noticeFailed,
    }
    return (
      <>
        {state.notice ? (
          <FormAlert data={{ 'data-commission-notice': state.notice }}>
            <p>
              {notice[state.notice]}
              {state.notice !== 'expired' && flow.contactEmail ? (
                <>
                  {' '}
                  <a href={`mailto:${flow.contactEmail}`}>{flow.contactEmail}</a>
                </>
              ) : null}
            </p>
          </FormAlert>
        ) : null}
        {errorKeys.length > 0 ? (
          <FormAlert
            data={{ 'data-error-summary': '' }}
            title={m.errorSummary}
            links={errorKeys.map((k) => ({
              href: `#anfrage-${k}`,
              text: `${labels[k]}: ${errorText(k)}`,
            }))}
          />
        ) : null}
      </>
    )
  }

  const v = state.values
  return (
    <>
      <RequiredNote>{m.requiredNote}</RequiredNote>
      <Field
        id="anfrage-name"
        name="name"
        label={m.nameLabel}
        required
        autoComplete="name"
        maxLength={100}
        defaultValue={v.name}
        error={errors.name ? errorText('name') : undefined}
      />
      <Field
        id="anfrage-email"
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
      <ObjectTypeWatch>
        <Select
          id="anfrage-objectType"
          name="objectType"
          label={m.objectTypeLabel}
          required
          emptyOption={m.objectTypeEmpty}
          defaultValue={v.objectType}
          options={Object.entries(m.objectTypes).map(([value, label]) => ({ value, label }))}
          error={errors.objectType ? errorText('objectType') : undefined}
        />
      </ObjectTypeWatch>
      <OtherFieldGate>
        <Field
          id="anfrage-objectTypeOther"
          name="objectTypeOther"
          label={m.objectTypeOtherLabel}
          maxLength={80}
          defaultValue={v.objectTypeOther}
          error={errors.objectTypeOther ? errorText('objectTypeOther') : undefined}
        />
      </OtherFieldGate>
      <Field
        id="anfrage-idea"
        name="idea"
        label={m.ideaLabel}
        hint={m.ideaHint}
        required
        multiline
        rows={6}
        maxLength={3000}
        defaultValue={v.idea}
        error={errors.idea ? errorText('idea') : undefined}
      />
      <Field
        id="anfrage-desiredTimeframe"
        name="desiredTimeframe"
        label={m.timeframeLabel}
        hint={m.timeframeHint}
        maxLength={120}
        defaultValue={v.desiredTimeframe}
        error={errors.desiredTimeframe ? errorText('desiredTimeframe') : undefined}
      />
      <Field
        id="anfrage-budget"
        name="budget"
        label={m.budgetLabel}
        hint={m.budgetHint}
        maxLength={60}
        defaultValue={v.budget}
        error={errors.budget ? errorText('budget') : undefined}
      />

      <fieldset className={styles.fieldset} data-commission-images="">
        <legend className={styles.legend}>{m.imagesLabel}</legend>
        <p className={styles.small} id="anfrage-bilder-hinweis" data-commission-images-hint="">
          {m.imagesHint}
        </p>
        <ImagesSlot noJsText={m.imagesNoJs} />
      </fieldset>

      <div className={styles.honeypot} aria-hidden="true">
        <label htmlFor="anfrage-website">{m.honeypotLabel}</label>
        <input
          id="anfrage-website"
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      <div className={styles.actions}>
        <Button type="submit">{m.submit}</Button>
      </div>
      <CommissionLive />
      <p className={styles.small} data-commission-privacy="">
        {flow.privacyNotice}{' '}
        <a href={flow.privacyHref} data-commission-privacy-link="">
          {m.privacyLink}
        </a>
      </p>
    </>
  )
}
