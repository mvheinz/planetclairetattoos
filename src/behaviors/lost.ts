import { getMotion, onMotionChange } from '../leash/motion'

import type { BehaviorContext, Unmount } from './types'

// `data-behavior="lost"` (R28, DESIGN KO-18, MI-11): Nachdem die Tuschelinie (Preset `lost`) die lose Leine einmal
// gezeichnet hat (`data-leash-drawn` an der Linien-Ebene), schwingen Leine und Leinenende zweimal langsam um den
// Aufhängepunkt (rotate ±2°, 2 × 1200 ms, `--ease-swing`); gleichzeitig rennt Coco winzig am Horizont einmal von der
// Bildmitte nach rechts aus dem Bild (2,4 s linear, Frames im 12-fps-Takt). Summe ≤ 5 s, danach steht alles still.
// Reduzierte Bewegung: nichts davon – Linie statisch, Coco nicht sichtbar. Ohne JavaScript ebenso.
//
// Markup (NotFoundContent): Wurzel `[data-behavior="lost"]` mit `[data-leash-anchor="start"]` (Aufhängepunkt),
// `[data-lost-end]` (Karabiner) und `[data-lost-coco]` (Coco, `data-size="horizon"`, per CSS unsichtbar).

export const SWING_MS = 1200
export const SWING_TIMES = 2
export const SWING_DEG = 2
export const RUN_MS = 2400
const FALLBACK_SWING_EASE = 'cubic-bezier(0.45, 0, 0.55, 1)'

function cssVar(doc: Document, name: string, fallback: string): string {
  const win = doc.defaultView
  const v = win ? win.getComputedStyle(doc.documentElement).getPropertyValue(name).trim() : ''
  return v || fallback
}

/** Pendel-Keyframes um den Aufhängepunkt: 0 → +a → −a → 0 (je Hälfte mit `--ease-swing`). */
export function swingKeyframes(deg: number, swingEasing: string): Keyframe[] {
  return [
    { transform: 'rotate(0deg)', easing: swingEasing },
    { transform: `rotate(${deg}deg)`, offset: 0.25, easing: swingEasing },
    { transform: `rotate(${-deg}deg)`, offset: 0.75, easing: swingEasing },
    { transform: 'rotate(0deg)' },
  ]
}

export function mount(root: Element, ctx: BehaviorContext = { mode: 'app' }): Unmount {
  void ctx
  const doc = root.ownerDocument
  const layer = doc.querySelector<HTMLElement>('[data-leash-layer]')
  const anchor = root.querySelector<HTMLElement>('[data-leash-anchor="start"]')
  const end = root.querySelector<HTMLElement>('[data-lost-end]')
  const coco = root.querySelector<HTMLElement>('[data-lost-coco]')
  const animations: Animation[] = []
  let played = false
  let observer: MutationObserver | null = null

  const stop = () => {
    for (const a of animations.splice(0)) a.cancel()
    coco?.setAttribute('data-boil', 'off')
    coco?.removeAttribute('data-running')
  }

  const play = () => {
    if (played || getMotion(doc) === 'reduced') return
    played = true
    observer?.disconnect()
    const swingEasing = cssVar(doc, '--ease-swing', FALLBACK_SWING_EASE)
    const frames = swingKeyframes(SWING_DEG, swingEasing)
    const timing: KeyframeAnimationOptions = {
      duration: SWING_MS,
      iterations: SWING_TIMES,
      fill: 'none',
    }
    if (anchor && layer) {
      const a = anchor.getBoundingClientRect()
      const px = a.left + a.width / 2
      const py = a.top + a.height
      for (const el of [layer, end]) {
        if (!el) continue
        const r = el.getBoundingClientRect()
        el.style.transformOrigin = `${(px - r.left).toFixed(1)}px ${(py - r.top).toFixed(1)}px`
        animations.push(el.animate(frames, timing))
      }
    }
    if (coco) {
      const scene = (coco.offsetParent as HTMLElement | null) ?? coco.parentElement
      const c = coco.getBoundingClientRect()
      const right = scene ? scene.getBoundingClientRect().right : (doc.defaultView?.innerWidth ?? 0)
      const distance = Math.max(0, right - c.left) + c.width + 8
      coco.setAttribute('data-boil', 'on')
      coco.setAttribute('data-running', '')
      const run = coco.animate(
        [
          { transform: 'translateX(0)', opacity: 1 },
          { transform: `translateX(${distance.toFixed(0)}px)`, opacity: 1 },
        ],
        { duration: RUN_MS, easing: 'linear', fill: 'none' },
      )
      animations.push(run)
      run.onfinish = () => {
        coco.setAttribute('data-boil', 'off')
        coco.removeAttribute('data-running')
      }
    }
  }

  if (layer && getMotion(doc) === 'full') {
    if (layer.hasAttribute('data-leash-drawn')) play()
    else {
      observer = new MutationObserver(() => {
        if (layer.hasAttribute('data-leash-drawn')) play()
      })
      observer.observe(layer, { attributes: true, attributeFilter: ['data-leash-drawn'] })
    }
  }
  const offMotion = onMotionChange((m) => {
    if (m === 'reduced') {
      observer?.disconnect()
      stop()
    }
  }, doc)

  return () => {
    observer?.disconnect()
    offMotion()
    stop()
    for (const el of [layer, end]) el?.style.removeProperty('transform-origin')
  }
}
