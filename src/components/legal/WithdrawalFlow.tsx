'use client'

import React, { lazy, useActionState, useCallback, useEffect, useRef } from 'react'

import { withdrawalAction } from '@/app/(frontend)/[locale]/withdraw-from-contract/actions'
import { afterLoad } from '@/components/forms/afterLoad'
import type { WithdrawalFlowState } from '@/lib/legal/withdrawalForm'

import { WithdrawalPendingContext } from './WithdrawalClient'
import styles from './WithdrawalFlow.module.css'
import type { WithdrawalViewFlow } from './WithdrawalView'

// Widerrufsfunktion R26 (PLAN P6.8, KONZEPT §3.16, DESIGN KO-12, § 356a BGB): Schritt 1 (Erklärung) → ggf. Auswahl der
// Stücke (Checkboxen, keine vorangekreuzt; nichts angehakt = ganzer Vertrag) → Schritt 2 (Zusammenfassung, „Ändern“,
// „Widerruf bestätigen“) → Ergebnis mit allen Angaben, Eingang (Europe/Berlin), Vorgangsnummer und Druckhinweis.
// `useActionState` mit einer Server Action: ohne JavaScript ein normales POST-Formular, dessen Antwort den nächsten
// Schritt rendert. Eingaben reisen zwischen den Schritten nur im signierten Formular-Token (POST), nie in der URL.
// Kein CAPTCHA; ein unsichtbarer Honeypot (`website`).
//
// Hier liegen nur Zustand, Server Action, `<form>` und Fokus. Den Inhalt der Schritte beschreibt `WithdrawalView`:
// Die Erstansicht rendert der Server (`initialView`, kein JS beim ersten Laden – Budget firstLoadJs); jeden weiteren
// Zustand rendert der Browser mit `WithdrawalView`, das nach dem `load`-Ereignis im Leerlauf vorgeladen wird
// (`React.lazy` ohne eigene Suspense-Grenze: der Server wartet darauf, im Browser bleibt bis dahin der alte Schritt).

export type { WithdrawalMessages } from './WithdrawalView'

export interface WithdrawalFlowProps extends WithdrawalViewFlow {
  initial: WithdrawalFlowState
  /** Erstansicht (`initial`), vom Server gerendert: Teil vor dem Formular und Inhalt des Formulars. */
  initialView: { pre: React.ReactNode; form: React.ReactNode }
}

const loadView = () => import('./WithdrawalView')
const WithdrawalView = lazy(() => loadView().then((mod) => ({ default: mod.WithdrawalView })))

export function WithdrawalFlow(props: WithdrawalFlowProps) {
  const { initial, initialView, ...flow } = props
  const [state, dispatch, pending] = useActionState(withdrawalAction, initial)
  const formRef = useRef<HTMLFormElement>(null)
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const focusDue = useRef(false)
  const first = useRef(true)

  useEffect(() => afterLoad(() => void loadView()), [])

  // Überschrift des aktuellen Schritts; wird sie erst nach dem Nachladen eingehängt, bekommt sie dann den Fokus.
  const headingCallback = useCallback((el: HTMLHeadingElement | null) => {
    headingRef.current = el
    if (el && focusDue.current) {
      focusDue.current = false
      el.focus()
    }
  }, [])

  // Nach jedem Schritt: Fokus auf die Überschrift (Tastatur/Screenreader); im Ergebnis die URL ohne Abfrage (R-137).
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (headingRef.current) headingRef.current.focus()
    else focusDue.current = true
    if (state.step === 'done' && window.location.search) {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [state])

  // Während des Sendens sind die Absende-Knöpfe `aria-disabled` (auch in der vom Server gerenderten Erstansicht).
  useEffect(() => {
    for (const b of formRef.current?.querySelectorAll('button[type="submit"]') ?? []) {
      if (pending) b.setAttribute('aria-disabled', 'true')
      else b.removeAttribute('aria-disabled')
    }
  }, [pending, state])

  // Ein Absenden zur Zeit (Doppelklick); ohne JavaScript schützt die Einmal-Kennung im Token (ein Datensatz).
  const guard = (e: React.FormEvent<HTMLFormElement>) => {
    if (pending) e.preventDefault()
  }

  const view = (part: 'pre' | 'form') =>
    state.rev === 0 ? (
      initialView[part]
    ) : (
      <WithdrawalView part={part} state={state} flow={flow} headingRef={headingCallback} />
    )

  return (
    <WithdrawalPendingContext value={pending}>
      <section
        className={styles.step}
        data-withdraw-step={state.step}
        key={`${state.step}-${state.rev}`}
      >
        {view('pre')}
        {state.step !== 'done' ? (
          <form
            ref={formRef}
            action={dispatch}
            onSubmit={guard}
            className={styles.form}
            noValidate={state.step === 'form'}
            data-withdraw-form=""
          >
            {view('form')}
          </form>
        ) : null}
      </section>
    </WithdrawalPendingContext>
  )
}
