import extra from '../art/coco/coco-extra-anchors.json'

import { COCO_JOY_EVENT } from '../behaviors/types'

import type { CocoController } from './coco'
import { COCO_FRAMES, makeGroup } from './cocoSprite'
import type { SpritePose } from './types'

// Zusatz-Aktionen der Coco (P12.4, U-03/U-04) – eigener, im Leerlauf nachgeladener Chunk samt eigener Sprite-Datei
// (`coco-extra.v1.svg`, nur Zusatz-Posen; Budget in `tests/perf/budgets.json`). Framework-frei.
// - Warte-Aktionen (U-03): sitzt Coco still, folgen gestaffelt Hecheln, Kopf schief + Ohr zucken, Hinterbein kratzt,
//   Gähnen und Strecken, Schwanz wedelt; bei sehr langer Ruhe Hinlegen (Bauch hoch), Einrollen und Schlafen.
// - Freudenhüpfer mit Drehung (U-04) bei Erfolg: Ereignis `pc:coco-joy` (Korb gefüllt, Bestellung abgeschickt).
// - Jede Aktion dauert ≤ 5 s und endet im Standbild (WCAG 2.2.2); der Boil-Takt je Pose steht in `coco.css`.
//   Reduzierte Bewegung: der Chunk wird gar nicht geladen bzw. bricht sofort ab (`x.p`).

/** Dauer des Freudenhüpfers in ms (3 Frames im Boil-Takt, mehrfach durchlaufen). */
export const JOY_MS = 1800

export type ExtraPose = keyof typeof extra.anchors

interface Step {
  /** Wartezeit in ms nach Beginn der Ruhe. */
  at: number
  pose: ExtraPose
  ms: number
  /** Danach in diese Pose wechseln (Brücken-Folge `einrollen-1`/`-2`). */
  then?: SpritePose
}

/**
 * Gestaffelter Ablauf beim Stillstand (U-03); zwischen den Aktionen steht Coco still. U-44: die Pausen zwischen den
 * Aktionen sind 20 % kürzer als in P12.4 (vorher 4 · 2,9 · 3,1 · 3,7 · 1,2 · 4,1 · 10 s, jetzt 3,2 · 2,3 · 2,5 · 3 · 1 ·
 * 3,3 · 8 s; mindestens 1 s Standbild bleibt).
 */
export const IDLE_PLAN: readonly Step[] = [
  { at: 3200, pose: 'hecheln', ms: 2600 },
  { at: 8100, pose: 'zucken', ms: 2400 },
  { at: 13000, pose: 'kratzen', ms: 2800 },
  { at: 18800, pose: 'gaehnen', ms: 2800 },
  { at: 22600, pose: 'verbeugung', ms: 2400 },
  { at: 28300, pose: 'wedeln', ms: 3000 },
  { at: 39300, pose: 'liegen', ms: 2600, then: 'schlafen' },
]

const REST: readonly (SpritePose | null)[] = ['sitzen', 'kopfschief']

export function attachExtra(ctl: CocoController): void {
  const { x, el } = ctl
  const svg = el.querySelector('svg')
  if (!svg || x.g.has('freude')) return
  Object.assign(x.a, extra.anchors)
  // Vorschau-Datei (file://): die Symbole liegen im selben Dokument (`href="#id"`); ein externer Pfad lüde dort nicht
  // und die Warte-Aktionen ließen Coco verschwinden.
  const base = svg.querySelector('use')?.getAttribute('href')?.startsWith('#') ? '' : extra.href
  for (const key of Object.keys(extra.anchors))
    x.g.set(
      key,
      makeGroup(
        svg,
        COCO_FRAMES.map((f) => `coco-${key}-${f}`),
        base,
      ),
    )

  const timers: ReturnType<typeof setTimeout>[] = []
  let playing = false
  const clear = () => {
    for (const t of timers.splice(0)) clearTimeout(t)
  }
  const end = () => {
    if (!playing) return
    playing = false
    x.b(false)
    x.s(ctl.pose())
  }
  const play = (key: ExtraPose, ms: number, done?: () => void) => {
    if (document.hidden || x.r) return
    playing = true
    x.s(key)
    x.b(true)
    timers.push(
      setTimeout(() => {
        end()
        done?.()
      }, ms),
    )
  }
  const schedule = () => {
    for (const step of IDLE_PLAN)
      timers.push(
        setTimeout(
          () => play(step.pose, step.ms, step.then ? () => ctl.setPose(step.then!) : undefined),
          step.at,
        ),
      )
  }
  x.p = () => {
    clear()
    end()
  }
  x.t = (pose) => {
    x.p?.()
    if (REST.includes(pose)) schedule()
  }
  const onJoy = () => {
    // nur wenn sie nicht gerade läuft oder springt (Pose und Brücken-Frames)
    if (!REST.includes(ctl.pose()) || !el.getAttribute('data-pose')?.match(/^[a-z]+$/)) return
    x.p?.()
    play('freude', JOY_MS, () => x.t?.(ctl.pose()))
  }
  document.addEventListener(COCO_JOY_EVENT, onJoy)
  x.o = () => document.removeEventListener(COCO_JOY_EVENT, onJoy)
  x.t(ctl.pose())
  // Coco reist mit (P12.12, MO-14): eigener nachgeladener Chunk, erst jetzt – nur bei voller Bewegung (`attachExtra` läuft nur dann)
  void import('./cocoTravel').then((t) => {
    if (!el.isConnected) return
    const stop = t.attachTravel(ctl)
    const prev = x.o
    x.o = () => {
      prev?.()
      stop()
    }
  })
}
