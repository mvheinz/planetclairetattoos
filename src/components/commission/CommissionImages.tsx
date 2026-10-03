'use client'

import React, { useRef } from 'react'

import type { CommissionFormMessages } from './CommissionForm'
import styles from './Commission.module.css'
import { IMAGE_MAX_COUNT, checkSelectedImage } from './imageRules'
import type { UploadedImage } from './imageUpload'

// Bildauswahl des Auftragsarbeiten-Formulars R10 (PLAN P7.13, KONZEPT §10.2): echtes `<input type="file" multiple>`,
// höchstens 5 Bilder, Prüfung je Datei, Verkleinern und einzelnes Hochladen mit Fortschritt (`./imageUpload`, erst bei
// der ersten Auswahl geladen), Kacheln 72 px mit „Entfernen“, Ansagen per `aria-live`. Hochgeladene Bilder gehen als
// verborgene Felder `images` mit dem Formular (in `CommissionForm`). Eigenes Modul, das `CommissionForm` erst nach dem
// `load`-Ereignis nachlädt (vorher steht der Hinweis „Bilder nur mit JavaScript“ wie ohne JavaScript) – hält das JS beim
// ersten Laden von R10 im Budget (firstLoadJs, tests/perf/budgets.json). Der Zustand liegt im Formular (`ImageStore`),
// damit Bilder ein erneutes Rendern nach Fehlern überstehen.

type ImageStatus = 'preparing' | 'uploading' | 'done' | 'failed'
export interface ImageItem {
  key: number
  name: string
  status: ImageStatus
  percent: number
  preview: string | null
  uploaded: UploadedImage | null
}

export interface ImageStore {
  images: ImageItem[]
  setImages: React.Dispatch<React.SetStateAction<ImageItem[]>>
  notes: string[]
  setNotes: React.Dispatch<React.SetStateAction<string[]>>
  nextKeyRef: React.RefObject<number>
  previewsRef: React.RefObject<Set<string>>
  /** Neue Auswahl (setzt den Hinweis „Bilder werden noch hochgeladen“ zurück). */
  onSelect: () => void
}

const fill = (text: string, vars: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''))

export function CommissionImages({
  locale,
  token,
  messages: m,
  store,
}: {
  locale: 'de' | 'en'
  token: string
  messages: CommissionFormMessages
  store: ImageStore
}) {
  const { images, setImages, nextKeyRef, previewsRef } = store
  const setImageMessages = store.setNotes
  const imageMessages = store.notes
  const fileRef = useRef<HTMLInputElement>(null)

  const update = (key: number, patch: Partial<ImageItem>) =>
    setImages((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)))

  const process = async (key: number, file: File) => {
    try {
      const { resizeForUpload, uploadImage } = await import('./imageUpload')
      const blob = await resizeForUpload(file)
      const preview = URL.createObjectURL(blob)
      previewsRef.current.add(preview)
      update(key, { status: 'uploading', percent: 0, preview })
      const uploaded = await uploadImage(blob, token, locale, (percent) => update(key, { percent }))
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
      added.push({ key: nextKeyRef.current++, file })
      count++
    }
    setImageMessages(notes)
    store.onSelect()
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
      previewsRef.current.delete(item.preview)
    }
    setImages((list) => list.filter((i) => i.key !== item.key))
    setImageMessages([fill(m.imageRemoved, { n: index + 1 })])
    fileRef.current?.focus()
  }

  const statusText = (item: ImageItem, n: number) =>
    item.status === 'preparing'
      ? fill(m.imagePreparing, { n })
      : item.status === 'uploading'
        ? fill(m.imageUploading, { n, percent: item.percent })
        : item.status === 'done'
          ? fill(m.imageDone, { n })
          : fill(m.imageFailed, { n })

  return (
    <>
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
    </>
  )
}
