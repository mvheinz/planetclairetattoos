import { getMotion, onMotionChange } from '../leash/motion'

import type { BehaviorContext, Unmount } from './types'

// `data-behavior="fitness-coco"` (P12.5, U-09): Fitness-Coco der Startseite. Das Standbild (eine Übung) steht im
// Server-HTML. Nach dem `load` (alle Module laden erst dann, `AFTER_LOAD`) holt das Modul die Bildfolge
// (`public/art/fitness-coco.v1.json`, ≈ 120 KB gz, nicht im Erstlade-JS) und spielt sie als Endlosschleife: sieben
// Übungen (je ≈ 5 s, 12–24 gezeichnete Zwischenbilder im 10-Bilder/s-Takt) und das erschöpfte Liegen, davor jeweils ein
// weicher Übergang. Pausiert außerhalb des Sichtbereichs und im verborgenen Tab; bei reduzierter Bewegung (System oder
// Schalter „Animationen“) steht das Standbild. Vorschau-Datei: Standbild (kein Netz). Kein Speicher, keine Cookies.
//
// Markup (`FitnessCoco.tsx`): Wurzel `[data-behavior="fitness-coco"][data-fitness-src]` mit `[data-fitness-ink]` und
// `[data-fitness-pencil]` (je ein `<path>`).

export interface FitnessData {
  f: number
  ex: { id: string; ms: number; fr: string[] }[]
  tr: string[][]
}

/** Bilder der Schleife in Reihenfolge: je Übung zuerst der Übergang, dann die Zwischenbilder im Kreis bis zur Dauer. */
export function* timeline(d: FitnessData): Generator<string> {
  for (;;)
    for (let i = 0; i < d.ex.length; i++) {
      yield* d.tr[i] ?? []
      const e = d.ex[i]!
      for (let k = 0, n = Math.round(e.ms / d.f); k < n; k++) yield e.fr[k % e.fr.length]!
    }
}

export function mount(root: Element, ctx: BehaviorContext = { mode: 'app' }): Unmount {
  const doc = root.ownerDocument
  const win = doc.defaultView
  const src = root.getAttribute('data-fitness-src')
  const ink = root.querySelector('[data-fitness-ink]')
  const pencil = root.querySelector('[data-fitness-pencil]')
  const still = [ink?.getAttribute('d') ?? '', pencil?.getAttribute('d') ?? '']
  let data: FitnessData | null = null
  let frames: Generator<string> | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let visible = true
  let destroyed = false
  let loading = false

  const show = (frame: string) => {
    const at = frame.indexOf('|')
    ink?.setAttribute('d', frame.slice(0, at))
    pencil?.setAttribute('d', frame.slice(at + 1))
  }
  const stop = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }
  const step = () => {
    timer = null
    if (destroyed || !data || !frames) return
    show(frames.next().value as string)
    timer = setTimeout(step, data.f)
  }
  const running = () => !destroyed && !!data && visible && !doc.hidden && getMotion(doc) === 'full'
  const update = () => {
    if (running()) {
      frames ??= timeline(data!)
      if (timer === null) step()
    } else {
      stop()
      if (getMotion(doc) === 'reduced' && still[0]) {
        ink?.setAttribute('d', still[0])
        pencil?.setAttribute('d', still[1]!)
        frames = null
      }
    }
  }
  const load = () => {
    if (
      loading ||
      data ||
      !src ||
      !ctx.actions?.fitnessData ||
      ctx.mode === 'preview' ||
      getMotion(doc) === 'reduced'
    )
      return
    loading = true
    ctx.actions
      ?.fitnessData?.(src)
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
    doc.removeEventListener('visibilitychange', update)
    offMotion()
    frames = null
    if (still[0]) {
      ink?.setAttribute('d', still[0])
      pencil?.setAttribute('d', still[1]!)
    }
  }
}
