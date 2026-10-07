'use client'

import React, { Fragment, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { mountBehaviors } from '@/behaviors'
import { CART_CHANGE_EVENT, SOLD_EVENT } from '@/behaviors/types'

// Bühne einer Mikro-Interaktion auf `/qa/motion` (KUNST-QA §3.2): rendert das Produkt-Markup erst nach der Hydrierung
// (sonst bände es die Seiten-`BehaviorHost` zusätzlich), bindet die `[data-behavior]`-Module der Bühne im Modus
// `preview` (kein Netz, kein Speicher – gleicher Code wie im Produkt) und startet den Auslöser. „Abspielen“ baut die
// Bühne neu auf und spielt von vorn. `data-qa-run` zählt die Durchläufe (für die Aufnahme).

type Step = (stage: HTMLElement, run: number) => void

const noopSubscribe = () => () => {}

const raf2 = (fn: () => void) => requestAnimationFrame(() => requestAnimationFrame(fn))

const reach: Step = (stage) =>
  stage
    .querySelectorAll('[data-leash-station]')
    .forEach((el) => el.setAttribute('data-leash-reached', ''))

/** Vorbereitung vor dem Binden der Module (z. B. frische Produkt-ID je Durchlauf). */
const freshProductId: Step = (stage, run) =>
  stage
    .querySelectorAll('[data-product-id]')
    .forEach((el) => el.setAttribute('data-product-id', `qa-mi01-${run}`))
const PREPARE: Record<string, Step> = { 'MI-01': freshProductId, 'MI-19': freshProductId }

/** Auslöser nach dem Binden. */
const PLAY: Record<string, Step> = {
  'MI-01': (stage) => stage.querySelector('form')?.requestSubmit(),
  'MI-19': (stage) => stage.querySelector('form')?.requestSubmit(),
  'MI-03': (stage) => {
    const id = stage.querySelector('[data-product-id]')?.getAttribute('data-product-id')
    if (id) document.dispatchEvent(new CustomEvent(SOLD_EVENT, { detail: { id } }))
  },
  'MI-04': (stage) => {
    const coco = stage.querySelector<HTMLElement>('[data-leash-coco]')
    if (!coco) return
    const flip = () => coco.toggleAttribute('data-qa-far')
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
    if (typeof doc.startViewTransition === 'function') doc.startViewTransition(flip)
    else flip()
  },
  'MI-05': () => document.querySelector<HTMLElement>('[data-menu-trigger]')?.click(),
  'MI-06': (stage) =>
    stage.querySelector<HTMLElement>('a')?.focus({ focusVisible: true } as FocusOptions),
  'MI-07': (_stage, run) =>
    document.dispatchEvent(new CustomEvent(CART_CHANGE_EVENT, { detail: { count: run } })),
  'MI-12': reach,
  'MI-13': reach,
  'MI-14': reach,
  'MI-15': (stage) => {
    const bar = stage.querySelector<HTMLElement>('[data-buy-bar]')
    if (!bar) return
    bar.hidden = false
    raf2(() => bar.setAttribute('data-visible', ''))
  },
}

export function QaReplay({
  mi,
  label,
  children,
  className,
}: {
  mi: string
  label: string
  children: React.ReactNode
  className?: string
}) {
  // Erst nach der Hydrierung rendern (Server-Schnappschuss `false`): `BehaviorHost` hat die Seite dann schon abgesucht.
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )
  const [played, setPlayed] = useState(1)
  const run = hydrated ? played : 0
  const stage = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = stage.current
    if (!run || !el) return
    PREPARE[mi]?.(el, run)
    const mounted = mountBehaviors(el, { mode: 'preview' })
    let active = true
    void mounted.ready.then(() => {
      if (!active) return
      raf2(() => {
        if (!active) return
        PLAY[mi]?.(el, run)
        el.setAttribute('data-qa-played', String(run))
      })
    })
    return () => {
      active = false
      mounted.unmount()
      if (mi === 'MI-05') document.querySelector<HTMLDialogElement>('dialog[open]')?.close()
    }
  }, [mi, run])

  return (
    <>
      <p>
        <button type="button" data-qa-play="" onClick={() => setPlayed((r) => r + 1)}>
          {label}
        </button>
      </p>
      <div ref={stage} className={className} data-qa-stage={mi} data-qa-run={run}>
        {run ? <Fragment key={run}>{children}</Fragment> : null}
      </div>
    </>
  )
}
