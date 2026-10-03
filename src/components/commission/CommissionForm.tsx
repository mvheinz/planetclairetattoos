'use client'

import React, { lazy, useActionState, useEffect, useRef, useState } from 'react'

import { submitCommissionInquiry } from '@/app/(frontend)/[locale]/commissions/actions'
import { afterLoad } from '@/components/forms/afterLoad'
import type { CommissionFormState } from '@/lib/commission/form'

import styles from './Commission.module.css'
import { CommissionContext } from './CommissionClient'
import type { CommissionImages, ImageItem } from './CommissionImages'
import type { CommissionViewFlow } from './CommissionView'

// Formular Auftragsarbeiten R10 (PLAN P7.13, KONZEPT §10, DESIGN KO-12): Pflichtfelder mit „*“, Fehlerzusammenfassung
// mit Sprunglinks (Fokus darauf), Auswahl „Was soll es werden?“ (bei „Etwas anderes“ ein Freitext), Bilder per echtem
// `<input type="file" multiple>` (höchstens 5, je Auswahl ≤ 15 MB, im Browser verkleinert auf ≤ 2560 px und ≤ 4 MB,
// einzeln hochgeladen mit Fortschritt; Fehler je Bild, Absenden ohne dieses Bild möglich; Kacheln 72 px mit
// „Entfernen“), Honeypot, unter „Anfrage senden“ der Datenschutzhinweis (`inquiry.privacyNotice`) mit Link auf den
// Abschnitt der Datenschutzerklärung (R-138), keine Einwilligungs-Checkbox. Server Action mit `useActionState`: ohne
// JavaScript ein normales POST-Formular (dann ohne Bilder, Hinweis „Bilder nur mit JavaScript“). Eingaben bleiben bei
// Fehlern nur im Seitenzustand (kein Browser-Speicher, R-130), nie in der URL (R-137). Erfolg ersetzt das Formular.
//
// Hier liegen nur Zustand, Server Action, `<form>`, Bild-Zustand und Fokus. Den Inhalt beschreibt `CommissionView`:
// Die Erstansicht rendert der Server (`initialView`, kein JS beim ersten Laden – Budget firstLoadJs); jeden weiteren
// Zustand rendert der Browser mit `CommissionView`, das nach dem `load`-Ereignis im Leerlauf vorgeladen wird
// (`React.lazy` ohne eigene Suspense-Grenze: der Server wartet darauf, im Browser bleibt bis dahin der alte Stand).
// Die Bildauswahl (CommissionImages.tsx) kommt ebenfalls erst nach `load`.

export type { CommissionFormMessages } from './CommissionView'

export interface CommissionFormProps extends CommissionViewFlow {
  initial: CommissionFormState
  /** Inhalt des Formulars im Erstzustand (`initial`), vom Server gerendert. */
  initialView: React.ReactNode
  /** Text nach dem Absenden aus dem CMS-Block (ohne Referenz), sonst Standardtext. */
  successText: string | null
}

const loadView = () => import('./CommissionView')
const CommissionView = lazy(() => loadView().then((mod) => ({ default: mod.CommissionView })))

const fill = (text: string, vars: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''))

export function CommissionForm(props: CommissionFormProps) {
  const { initial, initialView, successText, ...flow } = props
  const { locale, messages: m } = flow
  const [state, dispatch, pending] = useActionState(submitCommissionInquiry, initial)
  const [Images, setImagesComponent] = useState<typeof CommissionImages | null>(null)
  const [objectType, setObjectType] = useState(
    initial.step === 'form' ? initial.values.objectType : '',
  )
  const [images, setImages] = useState<ImageItem[]>([])
  const [imageNotes, setImageNotes] = useState<string[]>([])
  const [blocked, setBlocked] = useState(false)
  const nextKey = useRef(1)
  const previews = useRef(new Set<string>())
  const summaryRef = useRef<HTMLDivElement>(null)
  const successRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const token = state.step === 'form' ? state.token : ''

  // Nach dem Laden der Seite: Bildauswahl einhängen, Folgeansicht vorladen.
  useEffect(
    () =>
      afterLoad(() => {
        void loadView()
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

  // Während des Sendens ist „Anfrage senden“ `aria-disabled` (auch in der vom Server gerenderten Erstansicht).
  useEffect(() => {
    for (const b of formRef.current?.querySelectorAll('button[type="submit"]') ?? []) {
      if (pending) b.setAttribute('aria-disabled', 'true')
      else b.removeAttribute('aria-disabled')
    }
  }, [pending, state])

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
      : successText || m.successGeneric
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

  return (
    <CommissionContext
      value={{
        locale,
        messages: m,
        token,
        pending,
        blocked,
        busyImages,
        objectType,
        setObjectType,
        Images,
        store: {
          images,
          setImages,
          notes: imageNotes,
          setNotes: setImageNotes,
          nextKeyRef: nextKey,
          previewsRef: previews,
          onSelect: () => setBlocked(false),
        },
      }}
    >
      <div className={styles.form} key={`form-${state.rev}`} data-commission-form-state="form">
        <div ref={summaryRef} tabIndex={-1} className={styles.messages}>
          {state.rev === 0 ? null : <CommissionView part="messages" state={state} flow={flow} />}
        </div>

        <form
          ref={formRef}
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
          {state.rev === 0 ? (
            initialView
          ) : (
            <CommissionView part="fields" state={state} flow={flow} />
          )}
        </form>
      </div>
    </CommissionContext>
  )
}
