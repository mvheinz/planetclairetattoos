import extra from '../art/coco/coco-extra-anchors.json'

import { COCO_JOY_EVENT } from '../behaviors/types'

import type { CocoController } from './coco'
import { COCO_ANCHORS, COCO_FRAMES, makeGroup } from './cocoSprite'
import type { SpritePose } from './types'

// Zusatz-Aktionen der Coco (P12.4, U-03/U-04) – eigener, im Leerlauf nachgeladener Chunk samt eigener Sprite-Datei
// (`coco-extra.v1.svg`, nur Zusatz-Posen; Budget in `tests/perf/budgets.json`). Framework-frei.
// - Warte-Aktionen (U-03): sitzt Coco still, folgen gestaffelt Hecheln, Kopf schief + Ohr zucken, Hinterbein kratzt,
//   Gähnen und Strecken, Schwanz wedelt; bei sehr langer Ruhe Hinlegen (Bauch hoch), Einrollen und Schlafen.
// - Freudenhüpfer mit Drehung (U-04) bei Erfolg: Ereignis `pc:coco-joy` (Korb gefüllt, Bestellung abgeschickt).
// - Jede Aktion dauert ≤ 5 s und endet im Standbild (WCAG 2.2.2); der Boil-Takt je Pose steht in `coco.css`.
//   Reduzierte Bewegung: der Chunk wird gar nicht geladen bzw. bricht sofort ab (`x.stop`).

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

/** Gestaffelter Ablauf beim Stillstand (U-03); zwischen den Aktionen steht Coco still. */
export const IDLE_PLAN: readonly Step[] = [
  { at: 4000, pose: 'hecheln', ms: 2600 },
  { at: 9500, pose: 'zucken', ms: 2400 },
  { at: 15000, pose: 'kratzen', ms: 2800 },
  { at: 21500, pose: 'gaehnen', ms: 2800 },
  { at: 25500, pose: 'verbeugung', ms: 2400 },
  { at: 32000, pose: 'wedeln', ms: 3000 },
  { at: 45000, pose: 'liegen', ms: 2600, then: 'schlafen' },
]

const REST: readonly (SpritePose | null)[] = ['sitzen', 'kopfschief']

export function attachExtra(ctl: CocoController): void {
  const { x, el } = ctl
  const svg = el.querySelector('svg')
  if (!svg || x.groups.has('freude')) return
  Object.assign(COCO_ANCHORS, extra.anchors)
  for (const key of Object.keys(extra.anchors))
    x.groups.set(
      key,
      makeGroup(
        svg,
        COCO_FRAMES.map((f) => `coco-${key}-${f}`),
        extra.href,
      ),
    )

  let timers: ReturnType<typeof setTimeout>[] = []
  let playing = false
  const clear = () => {
    for (const t of timers.splice(0)) clearTimeout(t)
  }
  const end = () => {
    if (!playing) return
    playing = false
    x.boil(false)
    x.show(ctl.pose())
  }
  const play = (key: ExtraPose, ms: number, done?: () => void) => {
    if (document.hidden) return
    playing = true
    x.show(key)
    x.boil(true)
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
  x.stop = () => {
    clear()
    end()
  }
  x.tap = (pose) => {
    x.stop?.()
    if (REST.includes(pose)) schedule()
  }
  const onJoy = () => {
    // nur wenn sie nicht gerade läuft oder springt (Pose und Brücken-Frames)
    if (!REST.includes(ctl.pose()) || !el.getAttribute('data-pose')?.match(/^[a-z]+$/)) return
    x.stop?.()
    play('freude', JOY_MS, () => x.tap?.(ctl.pose()))
  }
  document.addEventListener(COCO_JOY_EVENT, onJoy)
  x.off = () => document.removeEventListener(COCO_JOY_EVENT, onJoy)
  x.tap(ctl.pose())
}
