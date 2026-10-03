'use client'

import React, { useActionState, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { submitCommissionInquiry } from '@/app/(frontend)/[locale]/commissions/actions'
import { Icon } from '@/components/icons/Icon'
import { Button } from '@/components/ui/Button'
import { Field, RequiredNote, Select } from '@/components/ui/Field'
import type de from '@/i18n/messages/de.json'
import type { CommissionFormState, CommissionNotice } from '@/lib/commission/form'
import type { CommissionField } from '@/lib/commission/submit'

import styles from './Commission.module.css'
import {
  IMAGE_MAX_COUNT,
  checkSelectedImage,
  resizeForUpload,
  uploadImage,
  type UploadedImage,
} from './imageUpload'

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

type ImageStatus = 'preparing' | 'uploading' | 'done' | 'failed'
interface ImageItem {
  key: number
  name: string
  status: ImageStatus
  percent: number
  preview: string | null
  uploaded: UploadedImage | null
}

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
  const [objectType, setObjectType] = useState(
    props.initial.step === 'form' ? props.initial.values.objectType : '',
  )
  const [images, setImages] = useState<ImageItem[]>([])
  const [imageMessages, setImageMessages] = useState<string[]>([])
  const [blocked, setBlocked] = useState(false)
  const nextKey = useRef(1)
  const previews = useRef(new Set<string>())
  const summaryRef = useRef<HTMLDivElement>(null)
  const successRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const token = state.step === 'form' ? state.token : ''
  const tokenRef = useRef(token)

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
  useEffect(() => {
    tokenRef.current = token
  }, [token])

  // Nach jedem Absenden: Fokus auf Erfolg bzw. Fehlerzusammenfassung/Hinweis
  useEffect(() => {
    if (state.rev === 0) return
    if (state.step === 'done') successRef.current?.focus()
    else summaryRef.current?.focus()
  }, [state])

  const update = (key: number, patch: Partial<ImageItem>) =>
    setImages((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)))

  const process = async (key: number, file: File) => {
    try {
      const blob = await resizeForUpload(file)
      const preview = URL.createObjectURL(blob)
      previews.current.add(preview)
      update(key, { status: 'uploading', percent: 0, preview })
      const uploaded = await uploadImage(blob, tokenRef.current, locale, (percent) =>
        update(key, { percent }),
      )
      update(key, { status: 'done', percent: 100, uploaded })
    } catch {
      update(key, { status: 'failed' })
    }
  }

  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    const notes: string[] = []
    const added: { key: number; file: File }[] = []
    let count = images.length
    for (const file of files) {
      if (count >= IMAGE_MAX_COUNT) {
        notes.push(fill(m.imageTooMany, { name: file.name }))
        continue
      }
      const check = checkSelectedImage(file)
      if (check !== 'ok') {
        notes.push(fill(check === 'type' ? m.imageWrongType : m.imageTooBig, { name: file.name }))
        continue
      }
      added.push({ key: nextKey.current++, file })
      count++
    }
    setImageMessages(notes)
    setBlocked(false)
    if (added.length === 0) return
    setImages((list) => [
      ...list,
      ...added.map(({ key, file }) => ({
        key,
        name: file.name,
        status: 'preparing' as const,
        percent: 0,
        preview: null,
        uploaded: null,
      })),
    ])
    for (const { key, file } of added) void process(key, file)
  }

  const remove = (item: ImageItem, index: number) => {
    if (item.preview) {
      URL.revokeObjectURL(item.preview)
      previews.current.delete(item.preview)
    }
    setImages((list) => list.filter((i) => i.key !== item.key))
    setImageMessages([fill(m.imageRemoved, { n: index + 1 })])
    fileRef.current?.focus()
  }

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
  const statusText = (item: ImageItem, n: number) =>
    item.status === 'preparing'
      ? fill(m.imagePreparing, { n })
      : item.status === 'uploading'
        ? fill(m.imageUploading, { n, percent: item.percent })
        : item.status === 'done'
          ? fill(m.imageDone, { n })
          : fill(m.imageFailed, { n })

  return (
    <div className={styles.form} key={`form-${state.rev}`} data-commission-form-state="form">
      <div ref={summaryRef} tabIndex={-1} className={styles.messages}>
        {state.notice ? (
          <div className={styles.notice} role="alert" data-commission-notice={state.notice}>
            <Icon name="warn" size={22} className={styles.noticeIcon} />
            <p>
              {notice[state.notice]}
              {state.notice !== 'expired' ? contact : null}
            </p>
          </div>
        ) : null}
        {errorKeys.length > 0 ? (
          <div className={styles.notice} role="alert" data-error-summary="">
            <Icon name="warn" size={22} className={styles.noticeIcon} />
            <div>
              <p className={styles.noticeTitle}>{m.errorSummary}</p>
              <ul>
                {errorKeys.map((k) => (
                  <li key={k}>
                    <a href={`#anfrage-${k}`}>
                      {labels[k]}: {errorText(k)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
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
          {mounted ? (
            <div className={styles.drop}>
              <label htmlFor="anfrage-bilder" className={styles.dropLabel}>
                {m.imagesChoose}
              </label>
              <p className={styles.small} id="anfrage-bilder-regeln">
                {m.imagesRules}
              </p>
              <input
                ref={fileRef}
                id="anfrage-bilder"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className={styles.fileInput}
                onChange={onFiles}
                aria-describedby="anfrage-bilder-hinweis anfrage-bilder-regeln"
                data-commission-file=""
              />
              {images.length > 0 ? (
                <ul className={styles.tiles}>
                  {images.map((item, index) => (
                    <li
                      key={item.key}
                      className={`${styles.tile} ${item.status === 'failed' ? styles.tileFailed : ''}`}
                      data-commission-image={item.status}
                    >
                      {item.preview ? (
                        // eslint-disable-next-line @next/next/no-img-element -- lokale Vorschau (blob:), nie hochgeladen sichtbar
                        <img
                          src={item.preview}
                          alt={fill(m.imageAlt, { n: index + 1 })}
                          className={styles.thumb}
                          width={72}
                          height={90}
                        />
                      ) : (
                        <span className={styles.thumb} aria-hidden="true" />
                      )}
                      <span className={styles.tileStatus} aria-live="polite">
                        {statusText(item, index + 1)}
                      </span>
                      <button
                        type="button"
                        className={styles.remove}
                        onClick={() => remove(item, index)}
                        aria-label={fill(m.imageRemoveLabel, { n: index + 1 })}
                      >
                        {m.imageRemove}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className={styles.live} aria-live="polite" data-commission-image-messages="">
                {imageMessages.map((text, i) => (
                  <p key={i} className={styles.small}>
                    {text}
                  </p>
                ))}
              </div>
            </div>
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
