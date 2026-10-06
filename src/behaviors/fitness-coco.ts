import { getMotion, onMotionChange } from '../leash/motion'

import type { BehaviorContext, Unmount } from './types'

// `data-behavior="fitness-coco"` (P12.5, U-09): Fitness-Coco der Startseite. Das Standbild (<img>, eine Übung) steht im
// Server-HTML. Nach dem `load` (alle Module laden erst dann, `AFTER_LOAD`) holt das Modul die Bildfolge
// (`public/art/fitness-coco.v1.json`, ≈ 120 KB gz, nicht im Erstlade-JS; der Abruf kommt als `ctx.actions.fitnessData`
// von der App) und spielt sie als Endlosschleife auf einer Leinwand über dem Standbild: sieben Übungen (je ≈ 5 s, 12–20
// gezeichnete Zwischenbilder im 10-Bilder/s-Takt) und das erschöpfte Liegen, davor jeweils ein weicher Übergang.
// Pausiert außerhalb des Sichtbereichs und im verborgenen Tab; bei reduzierter Bewegung (System oder Schalter
// „Animationen“) steht das Standbild. Vorschau-Datei: Standbild (kein Netz). Kein Speicher, keine Cookies.
// Gezeichnet wird auf einer Leinwand (nicht als Inline-SVG: Budget „SVG der Startseite“, PF-10; `Path2D` liest die
// Pfadtexte der Bildfolge direkt).
//
// Markup (`FitnessCoco.tsx`): Wurzel `[data-behavior="fitness-coco"][data-fitness-src]` mit `[data-fitness-still]` (<img>)
// und `[data-fitness-canvas]` (<canvas hidden>).

export interface FitnessData {
  f: number
  ex: { id: string; ms: number; fr: string[] }[]
  tr: string[][]
}

/** Bildfolge der Schleife: je Übung zuerst der Übergang, dann die Zwischenbilder im Kreis bis zur Dauer. */
export function* timeline(d: FitnessData): Generator<string> {
  for (;;)
    for (let i = 0; i < d.ex.length; i++) {
      yield* d.tr[i] ?? []
      const e = d.ex[i]!
      for (let k = 0, n = Math.round(e.ms / d.f); k < n; k++) yield e.fr[k % e.fr.length]!
    }
}

/** Buntstift: orange, unregelmäßig unterbrochen (Papierkörnung); Maße in Einheiten der 200 × 250-Zeichnung. */
const PENCIL = { color: 'rgba(217,130,43,0.85)', width: 1.2, dash: [5, 1.2, 3, 1.6, 7, 1] }
const INK_WIDTH = 1.5

export function mount(root: Element, ctx: BehaviorContext = { mode: 'app' }): Unmount {
  const doc = root.ownerDocument
  const win = doc.defaultView
  const src = root.getAttribute('data-fitness-src')
  const still = root.querySelector<HTMLElement>('[data-fitness-still]')
  const canvas = root.querySelector<HTMLCanvasElement>('[data-fitness-canvas]')
  let data: FitnessData | null = null
  let frames: Generator<string> | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let visible = true
  let destroyed = false
  let loading = false
  let last = ''
  const inkColor = () => win?.getComputedStyle(root).color || '#1c1a17'

  const size = () => {
    if (!canvas) return
    const k = Math.min(win?.devicePixelRatio || 1, 2)
    const w = Math.round((root as HTMLElement).clientWidth * k) || 400
    if (canvas.width !== w) {
      canvas.width = w
      canvas.height = Math.round(w * 1.25)
    }
  }
  const draw = (frame: string) => {
    last = frame
    const c2 = canvas?.getContext('2d')
    if (!canvas || !c2) return
    const at = frame.indexOf('|')
    const k = canvas.width / 200
    c2.setTransform(k, 0, 0, k, 0, 0)
    c2.clearRect(0, 0, 200, 250)
    c2.lineCap = 'round'
    c2.lineJoin = 'round'
    c2.setLineDash(PENCIL.dash)
    c2.lineWidth = PENCIL.width
    c2.strokeStyle = PENCIL.color
    c2.stroke(new Path2D(frame.slice(at + 1)))
    c2.setLineDash([])
    c2.lineWidth = INK_WIDTH
    c2.strokeStyle = inkColor()
    c2.stroke(new Path2D(frame.slice(0, at)))
  }
  const showStill = (on: boolean) => {
    if (still) still.style.visibility = on ? '' : 'hidden'
    if (canvas) canvas.hidden = on
  }
  const stop = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }
  const step = () => {
    timer = null
    if (destroyed || !data || !frames) return
    draw(frames.next().value as string)
    timer = setTimeout(step, data.f)
  }
  const running = () => !destroyed && !!data && visible && !doc.hidden && getMotion(doc) === 'full'
  const update = () => {
    if (running()) {
      frames ??= timeline(data!)
      if (timer === null) {
        size()
        showStill(false)
        step()
      }
    } else {
      stop()
      if (getMotion(doc) === 'reduced') {
        frames = null
        showStill(true)
      }
    }
  }
  const load = () => {
    if (loading || data || !src || !ctx.actions?.fitnessData || ctx.mode === 'preview') return
    if (getMotion(doc) === 'reduced') return
    loading = true
    ctx.actions
      .fitnessData(src)
      .then((json) => {
        if (destroyed || !json) return
        data = json as FitnessData
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
          if (timer === null && last && !canvas?.hidden) {
            size()
            draw(last)
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
    frames = null
    showStill(true)
  }
}
