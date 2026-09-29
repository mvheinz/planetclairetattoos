import { getMotion, onMotionChange } from '../leash/motion'

import type { BehaviorContext, Unmount } from './types'

// `data-behavior="price-tag-swing"` (DESIGN KO-05, MI-02): Preisschilder schwingen wie ein Anhänger an der Schnur –
// Pendel um die Öse `a → a+5° → a−3.5° → a+1.5° → a` bei 0/20/45/70/100 %, 900 ms, `--ease-swing` je Teilstück; nur
// `transform`. Auslöser: (1) eine Kartenreihe tritt erstmals in den Sichtbereich (Schwelle 0.3) – nach dem Zeichnen der
// Schnur (500 ms, Preset `shopString`), innerhalb der Reihe 60 ms versetzt; (2) Hover (feiner Zeiger) oder Fokus einer
// Karte. Jedes Schild schwingt höchstens einmal gleichzeitig. Bei reduzierter Bewegung: nichts.
// Markup: Wurzel (z. B. das Shop-Raster) mit `[data-product-card]`-Karten und darin `[data-price-tag-swing]` (Schild-
// Körper mit `data-angle` = Ruhewinkel). Kein Netz, kein Speicher – im Modus `preview` identisch.

export const SWING_MS = 900
export const ROW_STAGGER_MS = 60
/** Wartezeit nach dem Eintritt der Reihe: so lange zeichnet die Tuschelinie die Schnur (DESIGN §9.7 `shopString`). */
export const ENTER_DELAY_MS = 500
/** Pendel-Ausschläge relativ zum Ruhewinkel und ihre Zeitpunkte (MI-02). */
export const SWING_STEPS: readonly { offset: number; delta: number }[] = [
  { offset: 0, delta: 0 },
  { offset: 0.2, delta: 5 },
  { offset: 0.45, delta: -3.5 },
  { offset: 0.7, delta: 1.5 },
  { offset: 1, delta: 0 },
]
const FALLBACK_SWING_EASE = 'cubic-bezier(0.45, 0, 0.55, 1)'
/** Schilder gehören zu einer Reihe, wenn ihre Oberkanten höchstens so weit auseinanderliegen. */
const ROW_TOLERANCE_PX = 12

export function swingKeyframes(angle: number, easing: string): Keyframe[] {
  return SWING_STEPS.map(({ offset, delta }, i) => ({
    offset,
    transform: `rotate(${Math.round((angle + delta) * 100) / 100}deg)`,
    ...(i < SWING_STEPS.length - 1 ? { easing } : {}),
  }))
}

export function mount(root: Element, ctx: BehaviorContext = { mode: 'app' }): Unmount {
  void ctx
  const doc = root.ownerDocument
  const win = doc.defaultView
  const running = new Map<Element, Animation>()
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const fine = win?.matchMedia?.('(hover: hover) and (pointer: fine)')

  const easing = () =>
    (win
      ? win.getComputedStyle(doc.documentElement).getPropertyValue('--ease-swing').trim()
      : '') || FALLBACK_SWING_EASE

  const tagsIn = (scope: ParentNode): Element[] => {
    const own = scope instanceof Element && scope.matches('[data-price-tag-swing]') ? [scope] : []
    return [...own, ...Array.from(scope.querySelectorAll('[data-price-tag-swing]'))]
  }

  const swing = (el: Element) => {
    if (running.has(el) || getMotion(doc) === 'reduced') return
    if (typeof (el as HTMLElement).animate !== 'function') return
    const angle = Number.parseFloat(el.getAttribute('data-angle') ?? '0') || 0
    const anim = (el as HTMLElement).animate(swingKeyframes(angle, easing()), {
      duration: SWING_MS,
      fill: 'none',
    })
    running.set(el, anim)
    anim.onfinish = () => running.delete(el)
  }

  const later = (fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timers.delete(id)
      fn()
    }, ms)
    timers.add(id)
  }

  const observer =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(
          (entries) => {
            const entering = entries
              .filter((e) => e.isIntersecting)
              .map((e) => ({ el: e.target, box: e.boundingClientRect }))
              .sort((a, b) => a.box.top - b.box.top || a.box.left - b.box.left)
            let rowTop = Number.NEGATIVE_INFINITY
            let indexInRow = 0
            for (const { el, box } of entering) {
              observer?.unobserve(el)
              if (box.top - rowTop > ROW_TOLERANCE_PX) {
                rowTop = box.top
                indexInRow = 0
              }
              later(() => swing(el), ENTER_DELAY_MS + indexInRow * ROW_STAGGER_MS)
              indexInRow++
            }
          },
          { threshold: 0.3 },
        )
      : null
  for (const el of tagsIn(root)) observer?.observe(el)

  const cardOf = (target: EventTarget | null): Element | null =>
    target instanceof Element ? target.closest('[data-product-card]') : null

  const onPointerOver = (event: Event) => {
    const e = event as PointerEvent
    if (e.pointerType && e.pointerType !== 'mouse') return
    if (fine && !fine.matches) return
    const card = cardOf(e.target)
    if (!card || !root.contains(card) || card.contains(e.relatedTarget as Node | null)) return
    for (const el of tagsIn(card)) swing(el)
  }
  const onFocusIn = (event: Event) => {
    const card = cardOf(event.target)
    if (!card || !root.contains(card)) return
    for (const el of tagsIn(card)) swing(el)
  }

  const stopAll = () => {
    for (const id of timers) clearTimeout(id)
    timers.clear()
    for (const anim of running.values()) anim.cancel()
    running.clear()
  }

  root.addEventListener('pointerover', onPointerOver)
  root.addEventListener('focusin', onFocusIn)
  const offMotion = onMotionChange((m) => {
    if (m === 'reduced') stopAll()
  }, doc)

  return () => {
    observer?.disconnect()
    root.removeEventListener('pointerover', onPointerOver)
    root.removeEventListener('focusin', onFocusIn)
    offMotion()
    stopAll()
  }
}
