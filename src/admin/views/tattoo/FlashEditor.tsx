'use client'

import { useRouter } from 'next/navigation'
import React, { useRef, useState } from 'react'

import { parseEuroInput } from '@/lib/money'
import { FLASH_NUMBER_MAX, FLASH_NUMBER_MIN } from '@/lib/tattoo/flash'

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

// „Neuer Flash“ / „Flash bearbeiten“ (PLAN P7.6, KONZEPT §7.12): Zeichnung über den Foto-Baustein (P5.5, Alt-Text DE
// Pflicht, „Vorschlag“), Nummer (vorbelegt), Titel DE/EN mit „Übersetzen“, Größe in cm + Zusatz, Festpreis (≥ 10 €),
// einmalig/wiederholbar, online. Gespeichert über die REST-API von `flash` (der Hook prüft Nummer, Preis und
// „wiederholbar ⇒ verfügbar“; `afterChange` erneuert die Flash-Seite).

export interface FlashFormValues {
  id: number | null
  number: string
  title: Loc
  sizeCm: string
  sizeNote: Loc
  price: string
  repeatable: boolean
  published: boolean
  photos: PiecePhoto[]
}

type Doc = Record<string, unknown>

export function FlashEditor({
  initial,
  backHref,
  translateDisabled,
}: {
  initial: FlashFormValues
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
  const errors = errorsOf(issues)
  const set = <K extends keyof FlashFormValues>(key: K, value: FlashFormValues[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const validate = (): Doc => {
    const out: FieldIssue[] = []
    const number = Number(form.number.trim())
    if (!Number.isInteger(number) || number < FLASH_NUMBER_MIN || number > FLASH_NUMBER_MAX)
      out.push({ field: 'number', message: tattooText('flashNumberInvalid') })
    const title = form.title.de.trim()
    if (title.length < 2 || title.length > 60)
      out.push({ field: 'title.de', message: tattooText('flashTitleInvalid') })
    const size = Number(form.sizeCm.trim().replace(',', '.'))
    if (!(size > 0 && size <= 60 && Math.round(size * 10) === size * 10))
      out.push({ field: 'sizeCm', message: tattooText('flashSizeInvalid') })
    const priceCents = parseEuroInput(form.price, { min: 1000 })
    if (priceCents === null)
      out.push({ field: 'priceCents', message: tattooText('flashPriceInvalid') })
    if (photos.length === 0) out.push({ field: 'image', message: tattooText('flashImageMissing') })
    if (out.length > 0) throw new IssuesError(out)
    return {
      number,
      title,
      sizeCm: size,
      sizeNote: form.sizeNote.de.trim() || null,
      priceCents,
      repeatable: form.repeatable,
      published: form.published,
      image: photos[0]!.id,
      extraImages: photos.slice(1).map((p) => p.id),
    }
  }

  /** Speichert und liefert die ID (für „Übersetzen“). */
  const persist = async (): Promise<number> => {
    const data = validate()
    setPhotos(await savePhotoMeta(photos))
    const res = await requestJson(
      form.id ? `/api/flash/${form.id}?locale=de&depth=0` : '/api/flash?locale=de&depth=0',
      { method: form.id ? 'PATCH' : 'POST', json: data },
    )
    if (!res.ok) throw new IssuesError(issuesOf(res.json))
    const id = Number((res.json.doc as Doc | undefined)?.id ?? form.id)
    const en = { title: form.title.en.trim(), sizeNote: form.sizeNote.en.trim() }
    if (en.title || en.sizeNote) {
      const r = await requestJson(`/api/flash/${id}?locale=en&depth=0`, {
        method: 'PATCH',
        json: { title: en.title || data.title, sizeNote: en.sizeNote || null },
      })
      if (!r.ok) throw new IssuesError(issuesOf(r.json, ''))
    }
    await deleteRemovedPhotos(removed)
    setRemoved([])
    if (!form.id) {
      setForm((f) => ({ ...f, id }))
      router.replace(`${backHref}&bearbeiten=${id}`)
    }
    return id
  }

  const run = async (fn: () => Promise<unknown>) => {
    if (running.current) return
    running.current = true
    setBusy(true)
    setIssues([])
    setSaved(false)
    try {
      await fn()
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
      const id = await persist()
      return `/api/flash/${id}/translate`
    } catch (err) {
      if (err instanceof IssuesError) {
        setIssues(err.issues)
        return null
      }
      throw err
    }
  }

  return (
    <form
      className="pc-settings__form pc-tattoo-editor"
      noValidate
      data-testid="flash-editor"
      onSubmit={(e) => {
        e.preventDefault()
        void run(persist)
      }}
    >
      <p>
        <a href={backHref} className="pc-admin-link">
          {tattooText('backToList')}
        </a>
      </p>
      <h2 className="pc-piece__heading">
        {form.id ? tattooText('flashEditHeading') : tattooText('flashNew')}
      </h2>
      <PhotoPicker
        photos={photos}
        setPhotos={setPhotos}
        max={5}
        recommended={1}
        altInfo={{ category: 'zeichnung', title: form.title.de }}
        onRemoved={(p) => setRemoved((r) => [...r, p.id])}
        onBusyChange={setUploading}
        disabled={busy}
      />
      {errors.image ? (
        <p className="pc-field__error" data-testid="tf-error-image">
          {errors.image}
        </p>
      ) : null}
      <TextInput
        path="number"
        label={tattooText('flashNumber')}
        hint={tattooText('flashNumberHint')}
        value={form.number}
        inputMode="numeric"
        required
        errors={errors}
        onChange={(v) => set('number', v)}
      />
      <LocInput
        path="title"
        label={tattooText('title')}
        value={form.title}
        maxLength={60}
        required
        errors={errors}
        onChange={(v) => set('title', v)}
      />
      <TranslateButton<{ doc?: Doc }>
        endpoint={form.id ? `/api/flash/${form.id}/translate` : null}
        hasEnglish={form.title.en.trim() !== '' || form.sizeNote.en.trim() !== ''}
        disabledReason={translateDisabled}
        disabled={busy || uploading}
        prepare={prepareTranslate}
        onTranslated={(r) =>
          setForm((f) => ({
            ...f,
            title: { ...f.title, en: String(r.doc?.title ?? '') },
            sizeNote: { ...f.sizeNote, en: String(r.doc?.sizeNote ?? '') },
          }))
        }
      />
      <TextInput
        path="sizeCm"
        label={tattooText('flashSizeCm')}
        hint={tattooText('flashSizeHint')}
        value={form.sizeCm}
        inputMode="decimal"
        required
        errors={errors}
        onChange={(v) => set('sizeCm', v)}
      />
      <LocInput
        path="sizeNote"
        label={tattooText('flashSizeNote')}
        hint={tattooText('flashSizeNoteHint')}
        value={form.sizeNote}
        maxLength={80}
        errors={errors}
        onChange={(v) => set('sizeNote', v)}
      />
      <TextInput
        path="priceCents"
        label={tattooText('flashPrice')}
        hint={tattooText('flashPriceHint')}
        value={form.price}
        inputMode="decimal"
        required
        errors={errors}
        onChange={(v) => set('price', v)}
      />
      <CheckInput
        path="repeatable"
        label={tattooText('flashRepeatableLabel')}
        hint={tattooText('flashRepeatableHint')}
        checked={form.repeatable}
        errors={errors}
        onChange={(v) => set('repeatable', v)}
      />
      <CheckInput
        path="published"
        label={tattooText('onlineLabel')}
        checked={form.published}
        errors={errors}
        onChange={(v) => set('published', v)}
      />
      <IssueList issues={issues} testId="flash-issues" />
      {saved ? (
        <Notice tone="success" data-testid="flash-saved">
          {tattooText('saved')}
        </Notice>
      ) : null}
      <p className="pc-admin-row">
        <button
          type="submit"
          className="pc-admin-btn pc-admin-btn--primary"
          disabled={busy || uploading}
          aria-busy={busy || undefined}
          data-testid="flash-save"
        >
          {busy ? adminText('actionBusy') : tattooText('save')}
        </button>
      </p>
    </form>
  )
}
