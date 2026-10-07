import {
  COLORS,
  CRAYON_DASH,
  CRAYON_W,
  GROUND_W,
  INK_W,
  VIEW,
  W,
  build,
  ground,
  type Draw,
} from '../lib/fitness/rig'
import { START_MS, loopMs, poseAt, type FitnessData } from '../lib/fitness/timeline'
import { getMotion, onMotionChange } from '../leash/motion'

import type { BehaviorContext, Unmount } from './types'

// `data-behavior="fitness-coco"` (P12.5, U-09): Fitness-Coco der Startseite. Das Standbild (<img>, freundlich stehend) steht
// im Server-HTML. Nach dem `load` (alle Module laden erst dann, `AFTER_LOAD`) holt das Modul den Ablaufplan
// (`public/art/fitness-coco.v2.json`, wenige KB; der Abruf kommt als `ctx.actions.fitnessData` von der App) und spielt die
// Endlosschleife auf einer Leinwand über dem Standbild: sieben Übungen (je ≈ 5 s) und das erschöpfte Liegen, weich
// ineinander überblendet. Jedes Bild wird aus dem Puppen-Gerüst (`src/lib/fitness/rig.ts`) gezeichnet: Papierfüllung,
// Wasch-Fläche, oranger Buntstift, schwarze Tusche. ≈ 30 Bilder/s, pausiert außerhalb des Sichtbereichs und im verborgenen
// Tab; bei reduzierter Bewegung (System oder Schalter „Animationen“) steht das Standbild. Vorschau-Datei: der Ablaufplan steckt
// in der Datei (`src/preview-runtime/main.ts`, kein Netz). Kein Speicher, keine Cookies.
//
// Markup (`FitnessCoco.tsx`): Wurzel `[data-behavior="fitness-coco"][data-fitness-src]` mit `[data-fitness-still]` (<img>)
// und `[data-fitness-canvas]` (<canvas hidden>).

export type { FitnessData }
/** Einblenden der Bewegung aus der Ruhepose des Standbilds (ms). */
const INTRO_MS = 1400
/** Kleinster Abstand zweier Bilder (ms): ≈ 30 Bilder/s. */
const FRAME_MS = 33

export function mount(root: Element, ctx: BehaviorContext = { mode: 'app' }): Unmount {
  const doc = root.ownerDocument
  const win = doc.defaultView
  const src = root.getAttribute('data-fitness-src')
  const still = root.querySelector<HTMLElement>('[data-fitness-still]')
  const canvas = root.querySelector<HTMLCanvasElement>('[data-fitness-canvas]')
  const floor = ground()
  let data: FitnessData | null = null
  let raf = 0
  let clock = START_MS
  let played = 0
  let lastTs = -1
  let visible = true
  let destroyed = false
  let loading = false
  let last: Draw[] | null = null
  const style = win?.getComputedStyle(root)
  const intro = () => {
    const x = Math.min(1, played / INTRO_MS)
    return x * x * (3 - 2 * x)
  }

  const size = () => {
    if (!canvas) return
    const k = Math.min(win?.devicePixelRatio || 1, 2)
    const w = Math.round((root as HTMLElement).clientWidth * k) || 400
    if (canvas.width !== w) {
      canvas.width = w
      canvas.height = Math.round((w * 5) / 4)
    }
  }
  const paint = (draws: Draw[]) => {
    last = draws
    const c2 = canvas?.getContext('2d')
    if (!canvas || !c2) return
    const ink = style?.color || COLORS.ink
    const paper = style?.getPropertyValue('--paper').trim() || COLORS.paper
    const k = canvas.width / W
    c2.setTransform(1, 0, 0, 1, 0, 0)
    c2.clearRect(0, 0, canvas.width, canvas.height)
    c2.setTransform(
      k * VIEW.s,
      0,
      0,
      k * VIEW.s,
      k * VIEW.ox * (1 - VIEW.s),
      k * VIEW.oy * (1 - VIEW.s),
    )
    c2.lineCap = 'round'
    c2.lineJoin = 'round'
    const fills = { paper, wash: COLORS.wash, harness: COLORS.harness, ink, tongue: COLORS.tongue }
    for (const d of [...floor, ...draws]) {
      const p = new Path2D(d.d)
      if (d.t === 'f') {
        c2.fillStyle = fills[d.c ?? 'paper']
        c2.fill(p)
      } else if (d.t === 'h') {
        c2.setLineDash(CRAYON_DASH)
        c2.globalAlpha = 0.9
        c2.lineWidth = CRAYON_W
        c2.strokeStyle = COLORS.crayon
        c2.stroke(p)
        c2.setLineDash([])
        c2.globalAlpha = 1
      } else {
        c2.lineWidth = d.t === 'w' ? GROUND_W : INK_W
        c2.strokeStyle = ink
        c2.stroke(p)
      }
    }
  }
  const showStill = (on: boolean) => {
    if (still) still.style.visibility = on ? '' : 'hidden'
    if (canvas) canvas.hidden = on
  }
  const stop = () => {
    if (raf) win?.cancelAnimationFrame(raf)
    raf = 0
    lastTs = -1
  }
  const frame = (ts: number) => {
    raf = 0
    if (destroyed || !data || !win) return
    if (lastTs >= 0) {
      const dt = ts - lastTs
      if (dt < FRAME_MS - 2) {
        raf = win.requestAnimationFrame(frame)
        return
      }
      clock += Math.min(dt, 100)
      played += Math.min(dt, 100)
    }
    lastTs = ts
    paint(build(poseAt(data, clock, intro())))
    raf = win.requestAnimationFrame(frame)
  }
  const running = () => !destroyed && !!data && visible && !doc.hidden && getMotion(doc) === 'full'
  const update = () => {
    if (running()) {
      if (!raf && win) {
        size()
        showStill(false)
        if (!last && data) paint(build(poseAt(data, clock, intro())))
        raf = win.requestAnimationFrame(frame)
      }
    } else {
      stop()
      if (getMotion(doc) === 'reduced') {
        last = null
        clock = START_MS
        played = 0
        showStill(true)
      }
    }
  }
  const load = () => {
    if (loading || data || !src || !ctx.actions?.fitnessData) return
    if (getMotion(doc) === 'reduced') return
    loading = true
    ctx.actions
      .fitnessData(src)
      .then((json) => {
        if (destroyed || !json) return
        const d = json as FitnessData
        if (d.v !== 2 || !Array.isArray(d.ex) || !loopMs(d)) return
        data = d
        update()
      })
      .catch(() => {})
  }
  const io =
    typeof win?.IntersectionObserver === 'function'
      ? new win.IntersectionObserver((entries) => {
          visible = entries[entries.length - 1]?.isIntersecting ?? true
          update()
        })
      : null
  io?.observe(root)
  const ro =
    typeof win?.ResizeObserver === 'function'
      ? new win.ResizeObserver(() => {
          if (!canvas?.hidden && last) {
            size()
            paint(last)
          }
        })
      : null
  ro?.observe(root)
  doc.addEventListener('visibilitychange', update)
  const offMotion = onMotionChange(() => {
    load()
    update()
  }, doc)
  load()
  return () => {
    destroyed = true
    stop()
    io?.disconnect()
    ro?.disconnect()
    doc.removeEventListener('visibilitychange', update)
    offMotion()
    showStill(true)
  }
}
