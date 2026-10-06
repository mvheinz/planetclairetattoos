'use client'

import { useRouter } from 'next/navigation'
import React, { useId, useRef, useState } from 'react'

import { ENUM_LABELS } from '@/lib/enumLabels'
import { TOUR_STATUSES, type TourStatus } from '@/lib/enums'
import { parseTourLink } from '@/lib/tour/address'
import { isTourTime, tourRangeFromInput } from '@/lib/tour/dates'

import { ActionButton } from '../../components/ActionButton'
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

// „Neuer Termin“ / „Termin bearbeiten“ (P12.8, U-20, KONZEPT §3.1a): Name, Ort/Bezirk und Notiz DE/EN mit „Übersetzen“,
// Datum von–bis (Enddatum leer = eintägig), Uhrzeiten, Adresse, Textlink, Standnummer, Foto vom Stand, Status (geplant ·
// abgesagt · vorbei – „vorbei“ folgt auch dem Datum) und online. Gespeichert über die REST-API von `tour-dates` (der Hook
// legt den Zeitraum auf ganze Berliner Tage, prüft die Adresse und erneuert die Startseite).

export interface TourFormValues {
  id: number | null
  name: Loc
  place: Loc
  note: Loc
  startDate: string
  endDate: string
  timeFrom: string
  timeTo: string
  address: string
  link: string
  standNumber: string
  status: TourStatus
  published: boolean
  photos: PiecePhoto[]
}

type Doc = Record<string, unknown>

export function TourEditor({
  initial,
  backHref,
  translateDisabled,
}: {
  initial: TourFormValues
  backHref: string
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
  const statusId = useId()
  const errors = errorsOf(issues)
  const set = <K extends keyof TourFormValues>(key: K, value: TourFormValues[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const validate = (): Doc => {
    const out: FieldIssue[] = []
    const range = tourRangeFromInput(form)
    if ('issues' in range)
      for (const i of range.issues) out.push({ field: i.path, message: i.message })
    const name = form.name.de.trim()
    if (name.length < 3 || name.length > 100)
      out.push({ field: 'name.de', message: tattooText('tourNameInvalid') })
    const place = form.place.de.trim()
    if (place.length < 2 || place.length > 80)
      out.push({ field: 'place.de', message: tattooText('tourPlaceInvalid') })
    for (const f of ['timeFrom', 'timeTo'] as const)
      if (form[f].trim() && !isTourTime(form[f].trim()))
        out.push({ field: f, message: tattooText('tourTimeInvalid') })
    if (form.link.trim() && !parseTourLink(form.link))
      out.push({ field: 'link', message: tattooText('tourLinkInvalid') })
    if (out.length > 0 || 'issues' in range) throw new IssuesError(out)
    return {
      name,
      startsAt: range.startsAt.toISOString(),
      endsAt: range.endsAt.toISOString(),
      place,
      address: form.address.trim() || null,
      link: form.link.trim() || null,
      standNumber: form.standNumber.trim() || null,
      timeFrom: form.timeFrom.trim() || null,
      timeTo: form.timeTo.trim() || null,
      note: form.note.de.trim() || null,
      image: photos[0]?.id ?? null,
      status: form.status,
      published: form.published,
    }
  }

  const persist = async (): Promise<number> => {
    const data = validate()
    setPhotos(await savePhotoMeta(photos))
    const res = await requestJson(
      form.id
        ? `/api/tour-dates/${form.id}?locale=de&depth=0`
        : '/api/tour-dates?locale=de&depth=0',
      { method: form.id ? 'PATCH' : 'POST', json: data },
    )
    if (!res.ok) throw new IssuesError(issuesOf(res.json))
    const id = Number((res.json.doc as Doc | undefined)?.id ?? form.id)
    const en = {
      name: form.name.en.trim(),
      place: form.place.en.trim(),
      note: form.note.en.trim(),
    }
    if (Object.values(en).some(Boolean)) {
      // Pflichttexte ohne Englisch: deutscher Text (wie die öffentliche Rückfall-Sprache)
      const r = await requestJson(`/api/tour-dates/${id}?locale=en&depth=0`, {
        method: 'PATCH',
        json: {
          name: en.name || data.name,
          place: en.place || data.place,
          note: en.note || null,
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
      return `/api/tour-dates/${await persist()}/translate`
    } catch (err) {
      if (err instanceof IssuesError) {
        setIssues(err.issues)
        return null
      }
      throw err
    }
  }

  const hasEnglish = [form.name, form.place, form.note].some((v) => v.en.trim() !== '')

  return (
    <form
      className="pc-settings__form pc-tattoo-editor"
      noValidate
      data-testid="tour-editor"
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
        {form.id ? tattooText('tourEditHeading') : tattooText('tourNew')}
      </h2>
      <LocInput
        path="name"
        label={tattooText('tourName')}
        value={form.name}
        maxLength={100}
        required
        errors={errors}
        onChange={(v) => set('name', v)}
      />
      <LocInput
        path="place"
        label={tattooText('tourPlace')}
        hint={tattooText('tourPlaceHint')}
        value={form.place}
        maxLength={80}
        required
        errors={errors}
        onChange={(v) => set('place', v)}
      />
      <LocInput
        path="note"
        label={tattooText('tourNote')}
        hint={tattooText('tourNoteHint')}
        value={form.note}
        multiline
        maxLength={240}
        errors={errors}
        onChange={(v) => set('note', v)}
      />
      <TranslateButton<{ doc?: Doc }>
        endpoint={form.id ? `/api/tour-dates/${form.id}/translate` : null}
        hasEnglish={hasEnglish}
        disabledReason={translateDisabled}
        disabled={busy || uploading}
        prepare={prepareTranslate}
        onTranslated={(r) =>
          setForm((f) => ({
            ...f,
            name: { ...f.name, en: String(r.doc?.name ?? '') },
            place: { ...f.place, en: String(r.doc?.place ?? '') },
            note: { ...f.note, en: String(r.doc?.note ?? '') },
          }))
        }
      />
      <fieldset className="pc-field pc-settings__group">
        <legend className="pc-field__label">{tattooText('tourWhen')}</legend>
        <p className="pc-piece__hint">{tattooText('tourWhenHint')}</p>
        <TextInput
          path="startDate"
          type="date"
          label={tattooText('tourStartDate')}
          value={form.startDate}
          required
          errors={errors}
          onChange={(v) => set('startDate', v)}
        />
        <TextInput
          path="endDate"
          type="date"
          label={tattooText('tourEndDate')}
          hint={tattooText('tourEndDateHint')}
          value={form.endDate}
          errors={errors}
          onChange={(v) => set('endDate', v)}
        />
        <TextInput
          path="timeFrom"
          type="time"
          label={tattooText('tourTimeFrom')}
          value={form.timeFrom}
          errors={errors}
          onChange={(v) => set('timeFrom', v)}
        />
        <TextInput
          path="timeTo"
          type="time"
          label={tattooText('tourTimeTo')}
          value={form.timeTo}
          errors={errors}
          onChange={(v) => set('timeTo', v)}
        />
      </fieldset>
      <TextInput
        path="address"
        label={tattooText('tourAddress')}
        hint={tattooText('tourAddressHint')}
        value={form.address}
        maxLength={160}
        errors={errors}
        onChange={(v) => set('address', v)}
      />
      <TextInput
        path="link"
        label={tattooText('tourLink')}
        hint={tattooText('tourLinkHint')}
        value={form.link}
        maxLength={300}
        errors={errors}
        onChange={(v) => set('link', v)}
      />
      <TextInput
        path="standNumber"
        label={tattooText('tourStand')}
        value={form.standNumber}
        maxLength={20}
        errors={errors}
        onChange={(v) => set('standNumber', v)}
      />
      <PhotoPicker
        photos={photos}
        setPhotos={setPhotos}
        max={1}
        recommended={0}
        altInfo={{ category: 'zeichnung', title: form.name.de }}
        onRemoved={(p) => setRemoved((r) => [...r, p.id])}
        onBusyChange={setUploading}
        disabled={busy}
      />
      <div className="pc-field">
        <label htmlFor={statusId} className="pc-field__label">
          {tattooText('tourStatus')}
        </label>
        <select
          id={statusId}
          value={form.status}
          data-testid="tf-status"
          onChange={(e) => set('status', e.target.value as TourStatus)}
        >
          {TOUR_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ENUM_LABELS.TOUR_STATUSES[s].de}
            </option>
          ))}
        </select>
        <p className="pc-piece__hint">{tattooText('tourStatusHint')}</p>
      </div>
      <CheckInput
        path="published"
        label={tattooText('onlineLabel')}
        checked={form.published}
        errors={errors}
        onChange={(v) => set('published', v)}
      />
      <IssueList issues={issues} testId="tour-issues" />
      {saved ? (
        <Notice tone="success" data-testid="tour-saved">
          {tattooText('saved')}
        </Notice>
      ) : null}
      <p className="pc-admin-row">
        <button
          type="submit"
          className="pc-admin-btn pc-admin-btn--primary"
          disabled={busy || uploading}
          aria-busy={busy || undefined}
          data-testid="tour-save"
        >
          {busy ? adminText('actionBusy') : tattooText('save')}
        </button>
        {form.id ? (
          <ActionButton
            variant="danger"
            effects={['delete']}
            data-testid="tour-delete"
            action={async () => {
              const res = await requestJson(`/api/tour-dates/${form.id}`, { method: 'DELETE' })
              if (!res.ok) throw new Error(String(res.json.error ?? res.status))
            }}
            onDone={() => router.replace(backHref)}
            confirm={{
              title: tattooText('tourDeleteTitle', { name: form.name.de }),
              consequence: tattooText('tourDeleteText'),
              confirmLabel: tattooText('tourDeleteConfirm'),
            }}
          >
            {tattooText('tourDelete')}
          </ActionButton>
        ) : null}
      </p>
    </form>
  )
}
