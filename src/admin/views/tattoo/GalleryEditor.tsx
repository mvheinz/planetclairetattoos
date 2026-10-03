'use client'

import { useRouter } from 'next/navigation'
import React, { useId, useRef, useState } from 'react'

import { ENUM_LABELS } from '@/lib/enumLabels'
import { CONSENT_SCOPES, TATTOO_PHOTO_KINDS } from '@/lib/enums'
import { galleryConsentComplete } from '@/lib/tattoo/gallery'

import { Notice } from '../../components/Notice'
import { PhotoPicker } from '../../components/PhotoPicker/PhotoPicker'
import type { PiecePhoto } from '../../components/PhotoPicker/photoList'
import { adminText } from '../../translations'
import type { FieldIssue } from '../pieces/pieceForm'
import {
  CheckInput,
  IssueList,
  IssuesError,
  LocInput,
  TextInput,
  deleteRemovedPhotos,
  errorsOf,
  issuesOf,
  requestJson,
  savePhotoMeta,
  type Loc,
} from './tattooForm'
import { tattooText } from './tattooText'

// Galerie-Foto anlegen/bearbeiten (PLAN P7.8, KONZEPT §9.7, DATENMODELL §6.16, E-42): Fotos (hochgeladen als
// `showsPerson = customer` → gesperrt, bis ein sichtbarer Eintrag mit Einwilligung sie zeigt), Art, Bildunterschrift,
// Körperstelle, „zeigt eine Kundin/einen Kunden“, Einwilligung (Häkchen, Umfang, Datum, Notiz, privater Nachweis),
// Instagram-Nennung nur mit Freigabe. „Online“ ist ohne vollständige Einwilligung gesperrt; der Hook prüft dasselbe
// (DM-GAL-01). Keine Felder für Gesundheitsdaten (V-25).

export interface GalleryFormValues {
  id: number | null
  kind: 'fresh' | 'healed'
  healedDurationMonths: string
  healedLabel: Loc
  caption: Loc
  placement: Loc
  showsCustomer: boolean
  consentGiven: boolean
  consentScope: 'tattoo_only' | 'with_face'
  consentDate: string
  consentNote: string
  consentEvidence: number | null
  consentEvidenceName: string | null
  /** Datum des Widerrufs (Anzeige), `null` = nie widerrufen. */
  consentWithdrawnAt: string | null
  creditHandleAllowed: boolean
  creditHandle: string
  published: boolean
  featured: boolean
  photos: PiecePhoto[]
}

type Doc = Record<string, unknown>

export function GalleryEditor({
  initial,
  backHref,
}: {
  initial: GalleryFormValues
  backHref: string
}) {
  const router = useRouter()
  const [form, setForm] = useState(initial)
  const [photos, setPhotos] = useState<PiecePhoto[]>(initial.photos)
  const [removed, setRemoved] = useState<number[]>([])
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [issues, setIssues] = useState<FieldIssue[]>([])
  const [saved, setSaved] = useState(false)
  const running = useRef(false)
  const kindId = useId()
  const scopeId = useId()
  const evidenceId = useId()
  const publishHintId = useId()
  const errors = errorsOf(issues)
  const set = <K extends keyof GalleryFormValues>(key: K, value: GalleryFormValues[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const consentComplete = galleryConsentComplete({
    showsCustomer: form.showsCustomer,
    consentGiven: form.consentGiven,
    consentDate: form.consentDate || null,
    consentNote: form.consentNote,
  })
  const publishLocked = !consentComplete
  const published = form.published && !publishLocked

  const validate = (): Doc => {
    const out: FieldIssue[] = []
    if (photos.length === 0)
      out.push({ field: 'image', message: tattooText('galleryImageMissing') })
    const months = form.healedDurationMonths.trim()
    if (form.kind === 'healed' && !/^\d{1,3}$/.test(months))
      out.push({ field: 'healedDurationMonths', message: tattooText('galleryMonthsInvalid') })
    if (out.length > 0) throw new IssuesError(out)
    return {
      image: photos[0]!.id,
      extraImages: photos.slice(1).map((p) => p.id),
      kind: form.kind,
      healedDurationMonths: form.kind === 'healed' ? Number(months) : null,
      healedLabel: form.healedLabel.de.trim() || null,
      caption: form.caption.de.trim() || null,
      placement: form.placement.de.trim() || null,
      showsCustomer: form.showsCustomer,
      consentGiven: form.consentGiven,
      consentScope: form.consentScope,
      // Datum als Berliner Mittag (kein Tageswechsel durch die Zeitzone)
      consentDate: form.consentDate ? `${form.consentDate}T12:00:00.000Z` : null,
      consentNote: form.consentNote.trim() || null,
      consentEvidence: form.consentEvidence,
      creditHandleAllowed: form.creditHandleAllowed,
      creditHandle: form.creditHandleAllowed ? form.creditHandle.trim() || null : null,
      published,
      featured: form.featured,
    }
  }

  const persist = async (): Promise<number> => {
    const data = validate()
    setPhotos(await savePhotoMeta(photos))
    const res = await requestJson(
      form.id
        ? `/api/tattoo-gallery/${form.id}?locale=de&depth=0`
        : '/api/tattoo-gallery?locale=de&depth=0',
      { method: form.id ? 'PATCH' : 'POST', json: data },
    )
    if (!res.ok) throw new IssuesError(issuesOf(res.json))
    const id = Number((res.json.doc as Doc | undefined)?.id ?? form.id)
    const en = {
      healedLabel: form.healedLabel.en.trim() || null,
      caption: form.caption.en.trim() || null,
      placement: form.placement.en.trim() || null,
    }
    if (Object.values(en).some(Boolean) || form.id) {
      const r = await requestJson(`/api/tattoo-gallery/${id}?locale=en&depth=0`, {
        method: 'PATCH',
        json: en,
      })
      if (!r.ok) throw new IssuesError(issuesOf(r.json))
    }
    // Nachweis dem Eintrag zuordnen (Frist L-19 b ab Widerruf)
    if (form.consentEvidence) {
      await requestJson(`/api/private-uploads/${form.consentEvidence}?depth=0`, {
        method: 'PATCH',
        json: { relatedGalleryItem: id },
      }).catch(() => undefined)
    }
    await deleteRemovedPhotos(removed)
    setRemoved([])
    if (!form.id) {
      setForm((f) => ({ ...f, id }))
      router.replace(`${backHref}&bearbeiten=${id}`)
    }
    return id
  }

  const run = async () => {
    if (running.current) return
    running.current = true
    setBusy(true)
    setIssues([])
    setSaved(false)
    try {
      await persist()
      setSaved(true)
      router.refresh()
    } catch (err) {
      setIssues(
        err instanceof IssuesError
          ? err.issues
          : [
              {
                field: '',
                message: adminText('actionFailed', {
                  message: String((err as Error)?.message ?? err),
                }),
              },
            ],
      )
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  const uploadEvidence = async (file: File | undefined) => {
    if (!file) return
    const body = new FormData()
    body.append('file', file)
    body.append(
      '_payload',
      JSON.stringify({
        purpose: 'consent_evidence',
        ...(form.id ? { relatedGalleryItem: form.id } : {}),
      }),
    )
    const res = await fetch('/api/private-uploads?depth=0', {
      method: 'POST',
      credentials: 'include',
      body,
    }).catch(() => null)
    const json = (await res?.json().catch(() => ({}))) as { doc?: { id?: number } }
    if (res?.ok && json.doc?.id) {
      setForm((f) => ({ ...f, consentEvidence: json.doc!.id!, consentEvidenceName: file.name }))
    } else {
      const found = issuesOf(json)
      setIssues(
        found.length
          ? found
          : [{ field: 'consentEvidence', message: tattooText('galleryEvidenceFailed') }],
      )
    }
  }

  return (
    <form
      className="pc-settings__form pc-tattoo-editor"
      noValidate
      data-testid="gallery-editor"
      onSubmit={(e) => {
        e.preventDefault()
        void run()
      }}
    >
      <p>
        <a href={backHref} className="pc-admin-link">
          {tattooText('backToList')}
        </a>
      </p>
      <h2 className="pc-piece__heading">
        {form.id ? tattooText('galleryEditHeading') : tattooText('galleryNew')}
      </h2>
      {form.consentWithdrawnAt ? (
        <Notice tone="warning" data-testid="gallery-withdrawn">
          {tattooText('galleryWithdrawnNotice', { date: form.consentWithdrawnAt })}
        </Notice>
      ) : null}
      <PhotoPicker
        photos={photos}
        setPhotos={setPhotos}
        max={5}
        recommended={1}
        uploadData={{ showsPerson: 'customer' }}
        altInfo={{ category: 'zeichnung', title: form.caption.de || 'Tattoo' }}
        onRemoved={(p) => setRemoved((r) => [...r, p.id])}
        onBusyChange={setUploading}
        disabled={busy}
      />
      {errors.image ? (
        <p className="pc-field__error" data-testid="tf-error-image">
          {errors.image}
        </p>
      ) : null}
      <div className="pc-field">
        <label htmlFor={kindId} className="pc-field__label">
          {tattooText('galleryKind')}
        </label>
        <select
          id={kindId}
          value={form.kind}
          data-testid="tf-kind"
          onChange={(e) => set('kind', e.target.value === 'healed' ? 'healed' : 'fresh')}
        >
          {TATTOO_PHOTO_KINDS.map((k) => (
            <option key={k} value={k}>
              {ENUM_LABELS.TATTOO_PHOTO_KINDS[k].de}
            </option>
          ))}
        </select>
      </div>
      {form.kind === 'healed' ? (
        <>
          <TextInput
            path="healedDurationMonths"
            label={tattooText('galleryMonths')}
            hint={tattooText('galleryMonthsHint')}
            value={form.healedDurationMonths}
            inputMode="numeric"
            required
            errors={errors}
            onChange={(v) => set('healedDurationMonths', v)}
          />
          <LocInput
            path="healedLabel"
            label={tattooText('galleryHealedLabel')}
            value={form.healedLabel}
            maxLength={40}
            errors={errors}
            onChange={(v) => set('healedLabel', v)}
          />
        </>
      ) : null}
      <LocInput
        path="caption"
        label={tattooText('galleryCaption')}
        value={form.caption}
        maxLength={200}
        errors={errors}
        onChange={(v) => set('caption', v)}
      />
      <LocInput
        path="placement"
        label={tattooText('galleryPlacement')}
        hint={tattooText('galleryPlacementHint')}
        value={form.placement}
        maxLength={60}
        errors={errors}
        onChange={(v) => set('placement', v)}
      />
      <CheckInput
        path="showsCustomer"
        label={tattooText('galleryShowsCustomer')}
        hint={tattooText('galleryShowsCustomerHint')}
        checked={form.showsCustomer}
        errors={errors}
        onChange={(v) => set('showsCustomer', v)}
      />
      <fieldset className="pc-field pc-settings__group" data-testid="gallery-consent-fields">
        <legend className="pc-field__label">{tattooText('galleryConsent')}</legend>
        <p className="pc-piece__hint">{tattooText('galleryInstagramHint')}</p>
        <CheckInput
          path="consentGiven"
          label={tattooText('galleryConsentGiven')}
          checked={form.consentGiven}
          errors={errors}
          onChange={(v) => set('consentGiven', v)}
        />
        <div className="pc-field">
          <label htmlFor={scopeId} className="pc-field__label">
            {tattooText('galleryConsentScope')}
          </label>
          <select
            id={scopeId}
            value={form.consentScope}
            onChange={(e) =>
              set('consentScope', e.target.value === 'with_face' ? 'with_face' : 'tattoo_only')
            }
          >
            {CONSENT_SCOPES.map((s) => (
              <option key={s} value={s}>
                {ENUM_LABELS.CONSENT_SCOPES[s].de}
              </option>
            ))}
          </select>
        </div>
        <TextInput
          path="consentDate"
          type="date"
          label={tattooText('galleryConsentDate')}
          value={form.consentDate}
          required={form.consentGiven}
          errors={errors}
          onChange={(v) => set('consentDate', v)}
        />
        <TextInput
          path="consentNote"
          label={tattooText('galleryConsentNote')}
          hint={tattooText('galleryConsentNoteHint')}
          value={form.consentNote}
          maxLength={300}
          required={form.consentGiven}
          errors={errors}
          onChange={(v) => set('consentNote', v)}
        />
        <div className="pc-field">
          <label htmlFor={evidenceId} className="pc-field__label">
            {tattooText('galleryEvidence')}
          </label>
          <input
            id={evidenceId}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            aria-describedby={`${evidenceId}-hint`}
            data-testid="gallery-evidence"
            onChange={(e) => void uploadEvidence(e.currentTarget.files?.[0])}
          />
          <p id={`${evidenceId}-hint`} className="pc-piece__hint">
            {form.consentEvidenceName
              ? tattooText('galleryEvidenceSaved', { name: form.consentEvidenceName })
              : tattooText('galleryEvidenceHint')}
          </p>
        </div>
        <CheckInput
          path="creditHandleAllowed"
          label={tattooText('galleryCreditAllowed')}
          checked={form.creditHandleAllowed}
          errors={errors}
          onChange={(v) => set('creditHandleAllowed', v)}
        />
        {form.creditHandleAllowed ? (
          <TextInput
            path="creditHandle"
            label={tattooText('galleryCreditHandle')}
            value={form.creditHandle}
            maxLength={31}
            errors={errors}
            onChange={(v) => set('creditHandle', v)}
          />
        ) : null}
      </fieldset>
      <div className="pc-field">
        <label className="pc-choice">
          <input
            type="checkbox"
            name="published"
            checked={published}
            disabled={publishLocked}
            aria-describedby={publishLocked ? publishHintId : undefined}
            data-testid="tf-published"
            onChange={(e) => set('published', e.target.checked)}
          />
          {tattooText('onlineLabel')}
        </label>
        {publishLocked ? (
          <p id={publishHintId} className="pc-field__error" data-testid="gallery-publish-locked">
            {tattooText('galleryPublishLocked')}
          </p>
        ) : null}
      </div>
      <CheckInput
        path="featured"
        label={tattooText('galleryFeatured')}
        checked={form.featured}
        errors={errors}
        onChange={(v) => set('featured', v)}
      />
      <IssueList issues={issues} testId="gallery-issues" />
      {saved ? (
        <Notice tone="success" data-testid="gallery-saved">
          {tattooText('saved')}
        </Notice>
      ) : null}
      <p className="pc-admin-row">
        <button
          type="submit"
          className="pc-admin-btn pc-admin-btn--primary"
          disabled={busy || uploading}
          aria-busy={busy || undefined}
          data-testid="gallery-save"
        >
          {busy ? adminText('actionBusy') : tattooText('save')}
        </button>
      </p>
    </form>
  )
}
