'use client'

import { useRouter } from 'next/navigation'
import React, { useId, useRef, useState } from 'react'

import { ENUM_LABELS } from '@/lib/enumLabels'
import { TATTOO_OFFER_TYPES } from '@/lib/enums'
import { offerTimesFromInput } from '@/lib/tattoo/offers'

import { Notice } from '../../components/Notice'
import { PhotoPicker } from '../../components/PhotoPicker/PhotoPicker'
import type { PiecePhoto } from '../../components/PhotoPicker/photoList'
import { TranslateButton } from '../../components/TranslateButton'
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

// „Neues Angebot“ / „Angebot bearbeiten“ (PLAN P7.7, KONZEPT §7.12, DATENMODELL §6.15): Art, Titel und Text DE/EN mit
// „Übersetzen“, Start- und Enddatum (eintägig = gleiches Datum), optionale Uhrzeiten → `startsAt`/`endsAt` in
// Europe/Berlin (`offerTimesFromInput`: ohne Uhrzeit 00:00 bzw. 23:59:59), Ort ohne Adresse (E-50, Prüfung im Hook),
// Preis-Info („Gesamtpreise nennen“), verknüpfte Flash-Motive, Bild, online. Beim Speichern trägt der Hook die
// Weckzeiten für `revalidateEndedOffers` ein (P7.3).

export interface OfferFormValues {
  id: number | null
  type: 'flash_day' | 'aktion'
  title: Loc
  description: Loc
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  locationNote: Loc
  priceNote: Loc
  flashes: number[]
  published: boolean
  photos: PiecePhoto[]
}

type Doc = Record<string, unknown>

export function OfferEditor({
  initial,
  backHref,
  flashOptions,
  translateDisabled,
}: {
  initial: OfferFormValues
  backHref: string
  flashOptions: { id: number; label: string }[]
  translateDisabled: string | null
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
  const typeId = useId()
  const errors = errorsOf(issues)
  const set = <K extends keyof OfferFormValues>(key: K, value: OfferFormValues[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const validate = (): Doc => {
    const out: FieldIssue[] = []
    const times = offerTimesFromInput(form)
    if ('issues' in times)
      for (const i of times.issues) out.push({ field: i.path, message: i.message })
    const title = form.title.de.trim()
    if (title.length < 3 || title.length > 80)
      out.push({ field: 'title.de', message: tattooText('offerTitleInvalid') })
    const description = form.description.de.trim()
    if (description.length < 10 || description.length > 1500)
      out.push({ field: 'description.de', message: tattooText('offerDescriptionInvalid') })
    if (out.length > 0 || 'issues' in times) throw new IssuesError(out)
    return {
      type: form.type,
      title,
      description,
      startsAt: times.startsAt.toISOString(),
      endsAt: times.endsAt.toISOString(),
      locationNote: form.locationNote.de.trim() || null,
      priceNote: form.priceNote.de.trim() || null,
      flashes: form.flashes,
      image: photos[0]?.id ?? null,
      published: form.published,
    }
  }

  const persist = async (): Promise<number> => {
    const data = validate()
    setPhotos(await savePhotoMeta(photos))
    const res = await requestJson(
      form.id
        ? `/api/tattoo-offers/${form.id}?locale=de&depth=0`
        : '/api/tattoo-offers?locale=de&depth=0',
      { method: form.id ? 'PATCH' : 'POST', json: data },
    )
    if (!res.ok) throw new IssuesError(issuesOf(res.json))
    const id = Number((res.json.doc as Doc | undefined)?.id ?? form.id)
    const en = {
      title: form.title.en.trim(),
      description: form.description.en.trim(),
      locationNote: form.locationNote.en.trim(),
      priceNote: form.priceNote.en.trim(),
    }
    if (Object.values(en).some(Boolean)) {
      // Pflichttexte ohne Englisch: deutscher Text (wie die öffentliche Rückfall-Sprache)
      const r = await requestJson(`/api/tattoo-offers/${id}?locale=en&depth=0`, {
        method: 'PATCH',
        json: {
          title: en.title || data.title,
          description: en.description || data.description,
          locationNote: en.locationNote || null,
          priceNote: en.priceNote || null,
        },
      })
      if (!r.ok) throw new IssuesError(issuesOf(r.json))
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

  const prepareTranslate = async (): Promise<string | null> => {
    try {
      return `/api/tattoo-offers/${await persist()}/translate`
    } catch (err) {
      if (err instanceof IssuesError) {
        setIssues(err.issues)
        return null
      }
      throw err
    }
  }

  const hasEnglish = [form.title, form.description, form.locationNote, form.priceNote].some(
    (v) => v.en.trim() !== '',
  )

  return (
    <form
      className="pc-settings__form pc-tattoo-editor"
      noValidate
      data-testid="offer-editor"
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
        {form.id ? tattooText('offerEditHeading') : tattooText('offerNew')}
      </h2>
      <div className="pc-field">
        <label htmlFor={typeId} className="pc-field__label">
          {tattooText('offerType')}
        </label>
        <select
          id={typeId}
          value={form.type}
          data-testid="tf-type"
          onChange={(e) => set('type', e.target.value === 'aktion' ? 'aktion' : 'flash_day')}
        >
          {TATTOO_OFFER_TYPES.map((t) => (
            <option key={t} value={t}>
              {ENUM_LABELS.TATTOO_OFFER_TYPES[t].de}
            </option>
          ))}
        </select>
      </div>
      <LocInput
        path="title"
        label={tattooText('title')}
        value={form.title}
        maxLength={80}
        required
        errors={errors}
        onChange={(v) => set('title', v)}
      />
      <LocInput
        path="description"
        label={tattooText('offerDescription')}
        value={form.description}
        multiline
        maxLength={1500}
        required
        errors={errors}
        onChange={(v) => set('description', v)}
      />
      <TranslateButton<{ doc?: Doc }>
        endpoint={form.id ? `/api/tattoo-offers/${form.id}/translate` : null}
        hasEnglish={hasEnglish}
        disabledReason={translateDisabled}
        disabled={busy || uploading}
        prepare={prepareTranslate}
        onTranslated={(r) =>
          setForm((f) => ({
            ...f,
            title: { ...f.title, en: String(r.doc?.title ?? '') },
            description: { ...f.description, en: String(r.doc?.description ?? '') },
            locationNote: { ...f.locationNote, en: String(r.doc?.locationNote ?? '') },
            priceNote: { ...f.priceNote, en: String(r.doc?.priceNote ?? '') },
          }))
        }
      />
      <fieldset className="pc-field pc-settings__group">
        <legend className="pc-field__label">{tattooText('offerWhen')}</legend>
        <p className="pc-piece__hint">{tattooText('offerWhenHint')}</p>
        <TextInput
          path="startDate"
          type="date"
          label={tattooText('offerStartDate')}
          value={form.startDate}
          required
          errors={errors}
          onChange={(v) => set('startDate', v)}
        />
        <TextInput
          path="endDate"
          type="date"
          label={tattooText('offerEndDate')}
          hint={tattooText('offerEndDateHint')}
          value={form.endDate}
          errors={errors}
          onChange={(v) => set('endDate', v)}
        />
        <TextInput
          path="startTime"
          type="time"
          label={tattooText('offerStartTime')}
          value={form.startTime}
          errors={errors}
          onChange={(v) => set('startTime', v)}
        />
        <TextInput
          path="endTime"
          type="time"
          label={tattooText('offerEndTime')}
          value={form.endTime}
          errors={errors}
          onChange={(v) => set('endTime', v)}
        />
      </fieldset>
      <LocInput
        path="locationNote"
        label={tattooText('offerLocation')}
        hint={tattooText('offerLocationHint')}
        value={form.locationNote}
        maxLength={120}
        errors={errors}
        onChange={(v) => set('locationNote', v)}
      />
      <LocInput
        path="priceNote"
        label={tattooText('offerPriceNote')}
        hint={tattooText('offerPriceNoteHint')}
        value={form.priceNote}
        maxLength={160}
        errors={errors}
        onChange={(v) => set('priceNote', v)}
      />
      <fieldset className="pc-field pc-settings__group" data-testid="offer-flashes">
        <legend className="pc-field__label">{tattooText('offerFlashes')}</legend>
        {flashOptions.length === 0 ? (
          <p className="pc-piece__hint">{tattooText('flashEmpty')}</p>
        ) : (
          <div className="pc-tattoo__checks">
            {flashOptions.map((o) => (
              <label key={o.id} className="pc-choice">
                <input
                  type="checkbox"
                  checked={form.flashes.includes(o.id)}
                  onChange={(e) =>
                    set(
                      'flashes',
                      e.target.checked
                        ? [...form.flashes, o.id]
                        : form.flashes.filter((x) => x !== o.id),
                    )
                  }
                />
                {o.label}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <PhotoPicker
        photos={photos}
        setPhotos={setPhotos}
        max={1}
        recommended={0}
        altInfo={{ category: 'zeichnung', title: form.title.de }}
        onRemoved={(p) => setRemoved((r) => [...r, p.id])}
        onBusyChange={setUploading}
        disabled={busy}
      />
      <CheckInput
        path="published"
        label={tattooText('onlineLabel')}
        checked={form.published}
        errors={errors}
        onChange={(v) => set('published', v)}
      />
      <IssueList issues={issues} testId="offer-issues" />
      {saved ? (
        <Notice tone="success" data-testid="offer-saved">
          {tattooText('saved')}
        </Notice>
      ) : null}
      <p className="pc-admin-row">
        <button
          type="submit"
          className="pc-admin-btn pc-admin-btn--primary"
          disabled={busy || uploading}
          aria-busy={busy || undefined}
          data-testid="offer-save"
        >
          {busy ? adminText('actionBusy') : tattooText('save')}
        </button>
      </p>
    </form>
  )
}
