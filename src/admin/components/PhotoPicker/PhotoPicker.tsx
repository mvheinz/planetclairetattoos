'use client'

import React, { useEffect, useId, useRef, useState } from 'react'

import { adminText } from '../../translations'
import { Notice } from '../Notice'
import {
  FOCAL_POSITIONS,
  MAX_PHOTOS,
  RECOMMENDED_PHOTOS,
  focalKey,
  freeSlots,
  movePhoto,
  removePhoto,
  suggestAlt,
  type AltSuggestionInput,
  type PiecePhoto,
} from './photoList'
import { PHOTO_ACCEPT, isAcceptedPhotoType, isUploadTooLarge, preparePhoto } from './resize'

// Foto-Baustein für „Neues Stück“ und „Stück bearbeiten“ (PLAN P5.5, KONZEPT §7.4): „Foto aufnehmen“ (Kamera,
// `capture="environment"`) und „Aus Galerie wählen“ (mehrere). Jedes Foto wird im Browser gedreht und auf höchstens
// 2560 px verkleinert und einzeln an `POST /api/media` geschickt; der Server entfernt EXIF/GPS (R-135). 1–12 Fotos,
// Hinweis unter 2, Reihenfolge per Hoch/Runter (erstes = Titelbild), Fokuspunkt, Alt-Texte, Entfernen. Gespeichert
// wird die Reihenfolge mit dem Stück (`images`), Alt-Texte und Fokuspunkt am Bild.

export interface PhotoPickerProps {
  photos: PiecePhoto[]
  setPhotos: React.Dispatch<React.SetStateAction<PiecePhoto[]>>
  /** Angaben für den Alt-Text-Vorschlag. */
  altInfo: Omit<AltSuggestionInput, 'index' | 'total'>
  /** Foto aus der Liste genommen (Aufrufer löscht es nach dem Speichern). */
  onRemoved?: (photo: PiecePhoto) => void
  /** Uploads laufen (Speichern so lange gesperrt). */
  onBusyChange?: (busy: boolean) => void
  disabled?: boolean
  /** Höchstzahl (Standard 12 wie bei Stücken; Flash/Galerie: 5 = Bild + 4 weitere). */
  max?: number
  /** Unter dieser Zahl erscheint der Hinweis „mehr Fotos“ (Standard 2). */
  recommended?: number
  /** Zusätzliche Felder beim Hochladen (z. B. `showsPerson: 'customer'` → Bild bleibt gesperrt, R-172). */
  uploadData?: Record<string, unknown>
}

type Feedback = { tone: 'error' | 'success' | 'info'; text: string } | null

interface MediaDoc {
  id: number
  url?: string | null
  sizes?: { thumb?: { url?: string | null } | null } | null
  focalX?: number | null
  focalY?: number | null
}

async function uploadPhoto(
  file: File,
  alt: string,
  extra: Record<string, unknown> = {},
): Promise<MediaDoc> {
  const body = new FormData()
  body.append('file', file)
  body.append('_payload', JSON.stringify({ alt, showsPerson: 'none', source: 'upload', ...extra }))
  let res: Response
  try {
    res = await fetch('/api/media?locale=de&depth=0', {
      method: 'POST',
      credentials: 'include',
      body,
    })
  } catch {
    throw new Error(adminText('actionOffline'))
  }
  const json = (await res.json().catch(() => ({}))) as {
    doc?: MediaDoc
    errors?: { message?: string; data?: { errors?: { message?: string }[] } }[]
  }
  if (!res.ok || !json.doc) {
    const first = json.errors?.[0]
    const message = first?.data?.errors?.[0]?.message ?? first?.message ?? res.statusText
    throw new Error(message)
  }
  return json.doc
}

export function PhotoPicker({
  photos,
  setPhotos,
  altInfo,
  onRemoved,
  onBusyChange,
  disabled = false,
  max = MAX_PHOTOS,
  recommended = RECOMMENDED_PHOTOS,
  uploadData,
}: PhotoPickerProps) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLOListElement>(null)
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const headingId = useId()
  const count = useRef(photos.length)
  useEffect(() => {
    count.current = photos.length
  }, [photos.length])

  const addFiles = async (list: FileList | null) => {
    const files = Array.from(list ?? [])
    if (files.length === 0) return
    const slots = Math.min(freeSlots(count.current), Math.max(0, max - count.current))
    const accepted = files.slice(0, slots)
    const rejected = files.slice(slots)
    const errors: string[] = rejected.map((f) => adminText('photoTooMany', { max, name: f.name }))
    setFeedback(null)
    setBusy({ done: 0, total: accepted.length })
    onBusyChange?.(true)
    let added = 0
    try {
      for (const [i, original] of accepted.entries()) {
        setBusy({ done: i, total: accepted.length })
        try {
          if (!isAcceptedPhotoType(original.type)) throw new Error(adminText('photoWrongType'))
          const prepared = await preparePhoto(original).catch(() => ({ file: original }))
          if (isUploadTooLarge(prepared.file.size)) throw new Error(adminText('photoTooLarge'))
          const index = count.current + 1
          const alt = suggestAlt({ ...altInfo, index, total: index })
          const doc = await uploadPhoto(prepared.file, alt, uploadData)
          count.current = index
          added++
          setPhotos((prev) => [
            ...prev,
            {
              id: doc.id,
              url: doc.sizes?.thumb?.url ?? doc.url ?? null,
              altDe: alt,
              altEn: '',
              altDeAuto: true,
              focalX: doc.focalX ?? 50,
              focalY: doc.focalY ?? 50,
              dirty: false,
            },
          ])
        } catch (err) {
          errors.push(
            adminText('photoUploadFailed', {
              name: original.name,
              message: err instanceof Error ? err.message : String(err),
            }),
          )
        }
      }
    } finally {
      setBusy(null)
      onBusyChange?.(false)
      if (cameraRef.current) cameraRef.current.value = ''
      if (galleryRef.current) galleryRef.current.value = ''
    }
    if (errors.length > 0) setFeedback({ tone: 'error', text: errors.join(' ') })
    else if (added > 0)
      setFeedback({ tone: 'success', text: adminText('photoAdded', { count: added }) })
  }

  const update = (index: number, patch: Partial<PiecePhoto>) =>
    setPhotos((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch, dirty: true } : p)))

  const move = (index: number, delta: -1 | 1) => {
    setPhotos((prev) => movePhoto(prev, index, delta))
    // Fokus folgt dem Foto (Tastatur-Bedienung).
    requestAnimationFrame(() => {
      const target = index + delta
      const btn = listRef.current?.querySelector<HTMLButtonElement>(
        `[data-photo-index="${target}"] [data-move="${delta < 0 ? 'up' : 'down'}"]`,
      )
      ;(btn && !btn.disabled
        ? btn
        : listRef.current?.querySelector<HTMLButtonElement>(`[data-photo-index="${target}"] button`)
      )?.focus()
    })
  }

  const remove = (index: number) => {
    const photo = photos[index]
    setPhotos((prev) => removePhoto(prev, index))
    if (photo) onRemoved?.(photo)
    setFeedback({ tone: 'info', text: adminText('photoRemoved') })
  }

  const suggestAll = () =>
    setPhotos((prev) =>
      prev.map((p, i) => ({
        ...p,
        altDe: suggestAlt({ ...altInfo, index: i + 1, total: prev.length }),
        altDeAuto: true,
        dirty: true,
      })),
    )

  const full = photos.length >= max
  const locked = disabled || busy !== null

  return (
    <section className="pc-photos" aria-labelledby={headingId} id="pf-images" tabIndex={-1}>
      <h2 id={headingId} className="pc-piece__heading">
        {adminText('photoHeading', { count: photos.length, max })}
      </h2>
      <div className="pc-admin-row">
        <label
          className={`pc-admin-btn pc-admin-btn--primary pc-photos__pick${full || locked ? ' is-disabled' : ''}`}
        >
          {adminText('photoCamera')}
          <input
            ref={cameraRef}
            type="file"
            accept={PHOTO_ACCEPT}
            capture="environment"
            className="pc-photos__input"
            disabled={full || locked}
            data-testid="photo-camera"
            onChange={(e) => void addFiles(e.currentTarget.files)}
          />
        </label>
        <label
          className={`pc-admin-btn pc-admin-btn--secondary pc-photos__pick${full || locked ? ' is-disabled' : ''}`}
        >
          {adminText('photoGallery')}
          <input
            ref={galleryRef}
            type="file"
            accept={PHOTO_ACCEPT}
            multiple
            className="pc-photos__input"
            disabled={full || locked}
            data-testid="photo-gallery"
            onChange={(e) => void addFiles(e.currentTarget.files)}
          />
        </label>
        {photos.length > 0 ? (
          <button
            type="button"
            className="pc-admin-btn pc-admin-btn--secondary"
            onClick={suggestAll}
            disabled={locked}
            data-testid="photo-suggest-alt"
          >
            {adminText('photoSuggestAlt')}
          </button>
        ) : null}
      </div>
      <p className="pc-piece__hint">{adminText('photoHint')}</p>
      <div aria-live="polite" role="status" className="pc-photos__status">
        {busy
          ? adminText('photoUploading', { current: busy.done + 1, total: busy.total })
          : full
            ? adminText('photoFull', { max })
            : ''}
      </div>
      {photos.length > 0 && photos.length < recommended ? (
        <Notice tone="warning" data-testid="photo-few">
          {adminText('photoFew')}
        </Notice>
      ) : null}
      {feedback ? (
        <Notice tone={feedback.tone} data-testid={`photo-feedback-${feedback.tone}`}>
          {feedback.text}
        </Notice>
      ) : null}
      <ol className="pc-photos__list" ref={listRef} data-testid="photo-list">
        {photos.map((photo, index) => (
          <li
            key={photo.id}
            className="pc-photos__item"
            data-photo-index={index}
            data-media-id={photo.id}
          >
            <div className="pc-photos__thumb">
              {photo.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- Vorschau aus der eigenen Medien-API
                <img
                  src={photo.url}
                  alt=""
                  width={96}
                  height={120}
                  style={{ objectPosition: `${photo.focalX}% ${photo.focalY}%` }}
                />
              ) : null}
              <span className="pc-photos__nr">
                {index === 0 ? adminText('photoCover') : adminText('photoNumber', { n: index + 1 })}
              </span>
            </div>
            <div className="pc-photos__fields">
              <label className="pc-field">
                <span className="pc-field__label">{adminText('photoAltDe', { n: index + 1 })}</span>
                <textarea
                  rows={2}
                  maxLength={250}
                  value={photo.altDe}
                  disabled={disabled}
                  data-testid="photo-alt-de"
                  onChange={(e) => update(index, { altDe: e.target.value, altDeAuto: false })}
                />
              </label>
              <label className="pc-field">
                <span className="pc-field__label">{adminText('photoAltEn', { n: index + 1 })}</span>
                <textarea
                  rows={2}
                  maxLength={250}
                  value={photo.altEn}
                  disabled={disabled}
                  data-testid="photo-alt-en"
                  onChange={(e) => update(index, { altEn: e.target.value })}
                />
              </label>
              <label className="pc-field">
                <span className="pc-field__label">{adminText('photoFocal')}</span>
                <select
                  value={focalKey(photo.focalX, photo.focalY)}
                  disabled={disabled}
                  data-testid="photo-focal"
                  onChange={(e) => {
                    const pos = FOCAL_POSITIONS.find((p) => p.key === e.target.value)
                    if (pos) update(index, { focalX: pos.x, focalY: pos.y })
                  }}
                >
                  {FOCAL_POSITIONS.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="pc-admin-row">
                <button
                  type="button"
                  className="pc-admin-btn pc-admin-btn--secondary"
                  data-move="up"
                  disabled={disabled || index === 0}
                  aria-label={adminText('photoUpLabel', { n: index + 1 })}
                  onClick={() => move(index, -1)}
                >
                  {adminText('photoUp')}
                </button>
                <button
                  type="button"
                  className="pc-admin-btn pc-admin-btn--secondary"
                  data-move="down"
                  disabled={disabled || index === photos.length - 1}
                  aria-label={adminText('photoDownLabel', { n: index + 1 })}
                  onClick={() => move(index, 1)}
                >
                  {adminText('photoDown')}
                </button>
                <button
                  type="button"
                  className="pc-admin-btn pc-admin-btn--secondary"
                  disabled={disabled}
                  aria-label={adminText('photoRemoveLabel', { n: index + 1 })}
                  onClick={() => remove(index)}
                >
                  {adminText('photoRemove')}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
