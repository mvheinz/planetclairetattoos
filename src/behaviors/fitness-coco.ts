import {
  COLORS,
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
// Wasch-Fläche, oranger Buntstift, schwarze Tusche. 20 Bilder/s (Rechnen und Malen in getrennten Takten), pausiert außerhalb des Sichtbereichs und im verborgenen
// Tab; bei reduzierter Bewegung (System oder Schalter „Animationen“) steht das Standbild. Vorschau-Datei: der Ablaufplan steckt
// in der Datei (`src/preview-runtime/main.ts`, kein Netz). Kein Speicher, keine Cookies.
//
// Markup (`FitnessCoco.tsx`): Wurzel `[data-behavior="fitness-coco"][data-fitness-src]` mit `[data-fitness-still]` (<img>)
// und `[data-fitness-canvas]` (<canvas hidden>).

export type { FitnessData }
/** Einblenden der Bewegung aus der Ruhepose des Standbilds (ms). */
const INTRO_MS = 1400
/** Stufen der Bildrate: Abstand zweier Bilder (ms) und Zahl der Mal-Takte. Je Bild gibt es einen Rechen-Takt, dann die Mal-Takte
 * (in einen Puffer, erst der fertige wird auf die Leinwand gelegt) – so bleibt jeder Anzeige-Takt kurz (PF-02). Stufe 0: 20 Bilder/s;
 * fallen Takte aus (zwei verspätete in 30 Takten), geht es einmalig auf Stufe 1 (10 Bilder/s, kleinere Häppchen) – langsame
 * Geräte bekommen so eine ruhigere, aber nie ruckelnde Seite. */
const LEVELS = [
  { wait: 50, parts: 2 },
  { wait: 100, parts: 5 },
] as const
const LATE_MS = 26

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
  let last: Prepared | null = null
  let pending: Prepared | null = null
  let stage = 0
  let level = 0
  let clean = 0
  let recent: boolean[] = []
  let prevTs = -1
  const style = win?.getComputedStyle(root)
  const intro = () => {
    const x = Math.min(1, played / INTRO_MS)
    return x * x * (3 - 2 * x)
  }

  const size = () => {
    if (!canvas) return
    const k = Math.min(win?.devicePixelRatio || 1, 1.5)
    const w = Math.round((root as HTMLElement).clientWidth * k) || 400
    if (canvas.width !== w) {
      canvas.width = w
      canvas.height = Math.round((w * 5) / 4)
    }
  }
  /** Pfadtexte → `Path2D` (der Teil des Malens, der nicht von der Leinwand abhängt). */
  type Prepared = { draws: Draw[]; paths: Path2D[] }
  const prepare = (draws: Draw[]): Prepared => {
    const all = [...floor, ...draws]
    return { draws: all, paths: all.map((d) => new Path2D(d.d)) }
  }
  /** Zeichenpuffer (nicht im DOM): das Bild entsteht darin in zwei Takten und wird erst fertig auf die Leinwand gelegt. */
  let buf: HTMLCanvasElement | null = null
  const bufCtx = () => {
    if (!canvas) return null
    buf ??= doc.createElement('canvas')
    if (buf.width !== canvas.width || buf.height !== canvas.height) {
      buf.width = canvas.width
      buf.height = canvas.height
    }
    return buf.getContext('2d')
  }
  /** Teilstrecke `from … to` der Zeichenliste in den Puffer malen (bei `from = 0`: Puffer leeren und einrichten). */
  const drawPart = (pr: Prepared, from: number, to: number) => {
    const c2 = bufCtx()
    if (!canvas || !c2) return
    const ink = style?.color || COLORS.ink
    const paper = style?.getPropertyValue('--paper').trim() || COLORS.paper
    const k = canvas.width / W
    if (from === 0) {
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
    }
    const fills = { paper, wash: COLORS.wash, harness: COLORS.harness, ink, tongue: COLORS.tongue }
    for (let i = from; i < to; i++) {
      const d = pr.draws[i]!
      const p = pr.paths[i]!
      if (d.t === 'f') {
        c2.fillStyle = fills[d.c ?? 'paper']
        c2.fill(p)
      } else if (d.t === 'h') {
        c2.globalAlpha = 0.9
        c2.lineWidth = CRAYON_W
        c2.strokeStyle = COLORS.crayon
        c2.stroke(p)
        c2.globalAlpha = 1
      } else {
        c2.lineWidth = d.t === 'w' ? GROUND_W : INK_W
        c2.strokeStyle = ink
        c2.stroke(p)
      }
    }
  }
  /** Fertigen Puffer auf die sichtbare Leinwand legen (ein Aufruf, billig). */
  const blit = (pr: Prepared) => {
    last = pr
    const c2 = canvas?.getContext('2d')
    if (!canvas || !c2 || !buf) return
    c2.setTransform(1, 0, 0, 1, 0, 0)
    c2.clearRect(0, 0, canvas.width, canvas.height)
    c2.drawImage(buf, 0, 0)
  }
  const paint = (pr: Prepared) => {
    drawPart(pr, 0, pr.draws.length)
    blit(pr)
  }
  const showStill = (on: boolean) => {
    if (still) still.style.visibility = on ? '' : 'hidden'
    if (canvas) canvas.hidden = on
  }
  const stop = () => {
    if (raf) win?.cancelAnimationFrame(raf)
    raf = 0
    lastTs = -1
    prevTs = -1
    recent = []
    pending = null
    stage = 0
  }
  const frame = (ts: number) => {
    raf = 0
    if (destroyed || !data || !win) return
    // verspätete Takte zählen (Abstand zum vorigen Takt); nach Pause (Tab, Bildschirmrand) nicht werten
    if (prevTs >= 0 && ts - prevTs < 250) {
      const late = ts - prevTs > LATE_MS
      recent.push(late)
      if (recent.length > 30) recent.shift()
      clean = late ? 0 : clean + 1
      // erst nach dem Einblenden werten (Seite lädt noch); nach ≈ 20 s ohne verspäteten Takt einmal wieder Stufe 0 versuchen
      if (level === 0 && played > 1500 && recent.filter(Boolean).length >= 2) {
        level = 1
        clean = 0
      } else if (level === 1 && clean > 1200) {
        level = 0
        recent = []
        clean = 0
      }
    }
    prevTs = ts
    const L = LEVELS[level]!
    if (pending) {
      // Mal-Takte: Zeichenliste in Teilen in den Puffer, im letzten Takt auf die Leinwand legen
      const n = pending.draws.length
      const last = stage >= L.parts
      drawPart(
        pending,
        Math.floor(((stage - 1) * n) / L.parts),
        last ? n : Math.floor((stage * n) / L.parts),
      )
      if (last) {
        blit(pending)
        pending = null
        stage = 0
      } else stage++
    } else {
      if (lastTs >= 0 && ts - lastTs < L.wait - 5) {
        raf = win.requestAnimationFrame(frame)
        return
      }
      if (lastTs >= 0) {
        const dt = Math.min(ts - lastTs, 150)
        clock += dt
        played += dt
      }
      lastTs = ts
      // Rechen-Takt: Pose rechnen und Pfade vorbereiten
      pending = prepare(build(poseAt(data, clock, intro())))
      stage = 1
    }
    raf = win.requestAnimationFrame(frame)
  }
  const running = () => !destroyed && !!data && visible && !doc.hidden && getMotion(doc) === 'full'
  const update = () => {
    if (running()) {
      if (!raf && win) {
        size()
        showStill(false)
        if (!last && data) paint(prepare(build(poseAt(data, clock, intro()))))
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
