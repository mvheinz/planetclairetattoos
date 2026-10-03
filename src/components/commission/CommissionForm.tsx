'use client'

import React, {
  lazy,
  useActionState,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'

import { submitCommissionInquiry } from '@/app/(frontend)/[locale]/commissions/actions'
import { afterLoad } from '@/components/forms/afterLoad'
import { Button } from '@/components/ui/Button'
import { Field, RequiredNote, Select } from '@/components/ui/Field'
import type de from '@/i18n/messages/de.json'
import type { CommissionFormState, CommissionNotice } from '@/lib/commission/form'
import type { CommissionField } from '@/lib/commission/submit'

import styles from './Commission.module.css'
import type { ImageItem } from './CommissionImages'

// Formular Auftragsarbeiten R10 (PLAN P7.13, KONZEPT §10, DESIGN KO-12): Pflichtfelder mit „*“, Fehlerzusammenfassung
// mit Sprunglinks (Fokus darauf), Auswahl „Was soll es werden?“ (bei „Etwas anderes“ ein Freitext), Bilder per echtem
// `<input type="file" multiple>` (höchstens 5, je Auswahl ≤ 15 MB, im Browser verkleinert auf ≤ 2560 px und ≤ 4 MB,
// einzeln hochgeladen mit Fortschritt; Fehler je Bild, Absenden ohne dieses Bild möglich; Kacheln 72 px mit
// „Entfernen“), Honeypot, unter „Anfrage senden“ der Datenschutzhinweis (`inquiry.privacyNotice`) mit Link auf den
// Abschnitt der Datenschutzerklärung (R-138), keine Einwilligungs-Checkbox. Server Action mit `useActionState`: ohne
// JavaScript ein normales POST-Formular (dann ohne Bilder, Hinweis „Bilder nur mit JavaScript“). Eingaben bleiben bei
// Fehlern nur im Seitenzustand (kein Browser-Speicher, R-130), nie in der URL (R-137). Erfolg ersetzt das Formular.

export type CommissionFormMessages = (typeof de)['commission']['form']

export interface CommissionFormProps {
  locale: 'de' | 'en'
  messages: CommissionFormMessages
  initial: CommissionFormState
  privacyNotice: string
  privacyHref: string
  /** Text nach dem Absenden aus dem CMS-Block (ohne Referenz), sonst Standardtext. */
  successText: string | null
  contactEmail: string | null
}

const FIELD_ORDER: readonly CommissionField[] = [
  'name',
  'email',
  'objectType',
  'objectTypeOther',
  'idea',
  'desiredTimeframe',
  'budget',
]

// Bildauswahl erst nach dem `load`-Ereignis nachladen (CommissionImages.tsx), nicht im JS beim ersten Laden. Bewusst ohne
// `next/dynamic` (dessen Laufzeit kostet selbst gut 2 KB gz); die Bildauswahl braucht kein Server-Rendering.
type ImagesComponent = typeof import('./CommissionImages').CommissionImages

// Hinweise und Fehlerzusammenfassung gibt es erst nach dem Absenden – per `React.lazy` nachgeladen (ohne eigene
// Suspense-Grenze: der Server wartet darauf, im Browser bleibt bis dahin der alte Stand stehen).
const loadAlert = () => import('@/components/forms/FormAlert')
const FormAlert = lazy(loadAlert)

const noopSubscribe = () => () => {}

const fill = (text: string, vars: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''))

export function CommissionForm(props: CommissionFormProps) {
  const { locale, messages: m } = props
  const [state, dispatch, pending] = useActionState(submitCommissionInquiry, props.initial)
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )
  // Bildauswahl erst nach dem Laden der Seite (vorher wie ohne JavaScript der Hinweis „Bilder nur mit JavaScript“).
  const [Images, setImagesComponent] = useState<ImagesComponent | null>(null)
  const [objectType, setObjectType] = useState(
    props.initial.step === 'form' ? props.initial.values.objectType : '',
  )
  const [images, setImages] = useState<ImageItem[]>([])
  const [imageNotes, setImageNotes] = useState<string[]>([])
  const [blocked, setBlocked] = useState(false)
  const nextKey = useRef(1)
  const previews = useRef(new Set<string>())
  const summaryRef = useRef<HTMLDivElement>(null)
  const successRef = useRef<HTMLDivElement>(null)
  const token = state.step === 'form' ? state.token : ''

  useEffect(
    () =>
      afterLoad(() => {
        void loadAlert()
        void import('./CommissionImages').then((mod) =>
          setImagesComponent(() => mod.CommissionImages),
        )
      }),
    [],
  )

  // Vorschau-URLs beim Verlassen freigeben
  useEffect(() => {
    const urls = previews.current
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [])

  // Neues Formular-Token (abgelaufen): Uploads gehören zum alten Formular und entfallen
  const [imagesToken, setImagesToken] = useState(token)
  if (state.step === 'form' && imagesToken !== token) {
    setImagesToken(token)
    setImages([])
  }

  // Nach jedem Absenden: Fokus auf Erfolg bzw. Fehlerzusammenfassung/Hinweis
  useEffect(() => {
    if (state.rev === 0) return
    if (state.step === 'done') successRef.current?.focus()
    else summaryRef.current?.focus()
  }, [state])

  const busyImages = images.some((i) => i.status === 'preparing' || i.status === 'uploading')
  const guard = (e: React.FormEvent<HTMLFormElement>) => {
    if (pending) e.preventDefault()
    else if (busyImages) {
      e.preventDefault()
      setBlocked(true)
    }
  }

  if (state.step === 'done') {
    const text = state.reference
      ? fill(m.success, { reference: state.reference })
      : props.successText || m.successGeneric
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        className={styles.success}
        role="status"
        data-commission-success=""
        data-reference={state.reference ?? ''}
      >
        <p>{text}</p>
      </div>
    )
  }

  const errors = state.errors ?? {}
  const errorKeys = FIELD_ORDER.filter((k) => errors[k])
  const errorText = (k: CommissionField) =>
    errors[k] === 'required' && k !== 'objectTypeOther' ? m.errors.required : m.errors[k]
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
  const v = state.values
  const showOther = !mounted || objectType === 'sonstiges'
  const contact = props.contactEmail ? (
    <>
      {' '}
      <a href={`mailto:${props.contactEmail}`}>{props.contactEmail}</a>
    </>
  ) : null
  return (
    <div className={styles.form} key={`form-${state.rev}`} data-commission-form-state="form">
      <div ref={summaryRef} tabIndex={-1} className={styles.messages}>
        {state.notice ? (
          <FormAlert data={{ 'data-commission-notice': state.notice }}>
            <p>
              {notice[state.notice]}
              {state.notice !== 'expired' ? contact : null}
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
      </div>

      <form
        action={dispatch}
        onSubmit={guard}
        className={styles.form}
        noValidate
        data-commission-form=""
      >
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="formToken" value={state.token} />
        {images
          .filter((i) => i.status === 'done' && i.uploaded)
          .map((i) => (
            <input
              key={i.key}
              type="hidden"
              name="images"
              value={`${i.uploaded!.uploadId}.${i.uploaded!.ticket}`}
            />
          ))}
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
        <div onChange={(e) => setObjectType((e.target as unknown as HTMLSelectElement).value)}>
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
        </div>
        {showOther ? (
          <Field
            id="anfrage-objectTypeOther"
            name="objectTypeOther"
            label={m.objectTypeOtherLabel}
            maxLength={80}
            defaultValue={v.objectTypeOther}
            error={errors.objectTypeOther ? errorText('objectTypeOther') : undefined}
          />
        ) : null}
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
          {Images ? (
            <Images
              locale={locale}
              token={token}
              messages={m}
              store={{
                images,
                setImages,
                notes: imageNotes,
                setNotes: setImageNotes,
                nextKeyRef: nextKey,
                previewsRef: previews,
                onSelect: () => setBlocked(false),
              }}
            />
          ) : (
            <p className={styles.small} data-commission-nojs="">
              {m.imagesNoJs}
            </p>
          )}
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
          <Button type="submit" ariaDisabled={pending}>
            {m.submit}
          </Button>
        </div>
        <p className={styles.live} aria-live="polite">
          {pending ? m.busy : blocked && busyImages ? m.imagesPending : ''}
        </p>
        <p className={styles.small} data-commission-privacy="">
          {props.privacyNotice}{' '}
          <a href={props.privacyHref} data-commission-privacy-link="">
            {m.privacyLink}
          </a>
        </p>
      </form>
    </div>
  )
}
