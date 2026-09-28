import { getMotion, onMotionChange } from '../leash/motion'

import type { BehaviorContext, Unmount } from './types'

// `data-behavior="sold-stamp"` (DESIGN KO-06, MI-03): Stempel-Knall **nur im Moment des Verkaufs** – wenn eine
// geöffnete Seite den Wechsel auf `sold` live übernimmt (Modul `product-status`, P3.11) bzw. auf der Danke-Seite
// (P4). Beim Laden einer Seite mit verkauften Stücken passiert nichts (der Stempel steht statisch im HTML).
// Auslöser ist das Ereignis `SOLD_EVENT` am `document` mit `detail.id` (Produkt-ID); betroffen sind alle Elemente mit
// `data-product-id` = ID innerhalb der Wurzel (bzw. die Wurzel selbst). Deren verborgener Stempel `[data-sold-stamp]`
// wird sichtbar und „knallt“: `scale 1.8 / rotate −22° / opacity 0` → 60 %: `scale 0.94 / −13° / 1` → `scale 1 / −14°`
// (260 ms `--ease-stamp`, Winkel relativ zum Ruhewinkel `data-angle`), danach Schild-Ruck `translateY(1.5px)` 80 ms.
// Höchstens 3 Knalle je Seitenansicht, gestaffelt 120 ms. Reduzierte Bewegung: Stempel sofort statisch.
// Nur `transform`/`opacity`; kein Netz, kein Speicher.

export const SOLD_EVENT = 'pc:product-sold'
export interface SoldEventDetail {
  id: number | string
}

export const STAMP_MS = 260
export const JOLT_MS = 80
export const MAX_BANGS = 3
export const BANG_STAGGER_MS = 120
const FALLBACK_STAMP_EASE = 'cubic-bezier(0.18, 1.6, 0.4, 1)'

/** Knall relativ zum Ruhewinkel (Standard −14°): −22° → −13° → −14°. */
export function stampKeyframes(restAngle: number, easing: string): Keyframe[] {
  const at = (delta: number) => Math.round((restAngle + delta) * 100) / 100
  return [
    { offset: 0, transform: `rotate(${at(-8)}deg) scale(1.8)`, opacity: 0, easing },
    { offset: 0.6, transform: `rotate(${at(1)}deg) scale(0.94)`, opacity: 1, easing },
    { offset: 1, transform: `rotate(${at(0)}deg) scale(1)`, opacity: 1 },
  ]
}

export function mount(root: Element, ctx: BehaviorContext = { mode: 'app' }): Unmount {
  void ctx
  const doc = root.ownerDocument
  const win = doc.defaultView
  const animations = new Set<Animation>()
  const timers = new Set<ReturnType<typeof setTimeout>>()
  let bangs = 0
  let queued = 0

  const easing = () =>
    (win
      ? win.getComputedStyle(doc.documentElement).getPropertyValue('--ease-stamp').trim()
      : '') || FALLBACK_STAMP_EASE

  const track = (anim: Animation, then?: () => void) => {
    animations.add(anim)
    anim.onfinish = () => {
      animations.delete(anim)
      then?.()
    }
  }

  const bang = (stamp: HTMLElement) => {
    if (getMotion(doc) === 'reduced' || typeof stamp.animate !== 'function') return
    const rest = Number.parseFloat(stamp.getAttribute('data-angle') ?? '-14') || -14
    track(stamp.animate(stampKeyframes(rest, easing()), { duration: STAMP_MS }), () => {
      const body = stamp.closest<HTMLElement>('[data-price-tag-swing]')
      if (!body || getMotion(doc) === 'reduced') return
      const angle = Number.parseFloat(body.getAttribute('data-angle') ?? '0') || 0
      track(
        body.animate(
          [
            { transform: `rotate(${angle}deg) translateY(0)` },
            { transform: `rotate(${angle}deg) translateY(1.5px)` },
            { transform: `rotate(${angle}deg) translateY(0)` },
          ],
          { duration: JOLT_MS },
        ),
      )
    })
  }

  const hostsFor = (id: string): Element[] => {
    const sel = `[data-product-id="${id.replace(/["\\]/g, '')}"]`
    return [...(root.matches(sel) ? [root] : []), ...Array.from(root.querySelectorAll(sel))]
  }

  const onSold = (event: Event) => {
    const id = (event as CustomEvent<SoldEventDetail>).detail?.id
    if (id === undefined || id === null) return
    for (const host of hostsFor(String(id))) {
      const stamp = host.querySelector<HTMLElement>('[data-sold-stamp]')
      if (!stamp || !stamp.hidden) continue
      stamp.hidden = false
      host.querySelector('[data-price-tag]')?.setAttribute('data-sold', '')
      if (bangs >= MAX_BANGS || getMotion(doc) === 'reduced') continue
      bangs++
      const delay = queued++ * BANG_STAGGER_MS
      const timer = setTimeout(() => {
        timers.delete(timer)
        queued = Math.max(0, queued - 1)
        bang(stamp)
      }, delay)
      timers.add(timer)
    }
  }

  const stopAll = () => {
    for (const t of timers) clearTimeout(t)
    timers.clear()
    queued = 0
    for (const a of animations) a.cancel()
    animations.clear()
  }

  doc.addEventListener(SOLD_EVENT, onSold)
  const offMotion = onMotionChange((m) => {
    if (m === 'reduced') stopAll()
  }, doc)

  return () => {
    doc.removeEventListener(SOLD_EVENT, onSold)
    offMotion()
    stopAll()
  }
}
