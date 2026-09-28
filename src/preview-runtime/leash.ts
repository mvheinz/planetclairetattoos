import { mountCoco, type CocoController } from '../leash/coco'
import { getMotion, onMotionChange } from '../leash/motion'
import { PRESET_CONFIG, REST_POSE, isStaticPreset } from '../leash/presets'
import { mountLeash, type InspectableLeashHandle, type MountOptions } from '../leash/runtime'
import { mountStaticLeash } from '../leash/static'
import type { PresetId } from '../leash/types'

// Tuschelinie und Coco in der Vorschau-Datei (DESIGN §9.12, ARCHITEKTUR §14.6): dieselbe Engine wie die App
// (`src/components/leash/LeashLayer.tsx`), aber statisch gebündelt und sofort nach dem Einhängen der Seite gestartet.
// Coco nutzt die eingebetteten Symbole (`href: ''` → `#coco-…`). Rückgabe baut Linie, Coco und Listener wieder ab.

const noop = () => {}

const isPreset = (value: string | null | undefined): value is PresetId =>
  !!value && Object.prototype.hasOwnProperty.call(PRESET_CONFIG, value)

export function mountPageLeash(root: ParentNode, routeKey: string): () => void {
  const layer = root.querySelector<HTMLElement>('[data-leash-layer]')
  const preset = layer?.getAttribute('data-leash-preset')
  if (!layer || !isPreset(preset)) return noop
  const cleanups: (() => void)[] = []
  const rest = REST_POSE[preset] ?? 'sitzen'
  const cocoEl =
    PRESET_CONFIG[preset].coco?.size === 'leash'
      ? root.querySelector<HTMLElement>('[data-leash-coco]')
      : null
  let handle: InspectableLeashHandle | null = null
  let coco: CocoController | null = null
  if (isStaticPreset(preset)) {
    handle = mountStaticLeash(layer, { preset, routeKey })
  } else {
    if (cocoEl) {
      coco = mountCoco(cocoEl, {
        pose: rest,
        motion: getMotion(),
        href: '',
        onPose: (e) => handle?.notePose(e),
      })
      cleanups.push(() => coco?.destroy())
    }
    const options: MountOptions = { preset, routeKey }
    if (coco && cocoEl) {
      const c = coco
      options.cocoPose = () => c.pose()
      options.onCoco = (s) => {
        c.setPose(s.pose)
        if (s.moving) c.activity()
        c.place(s.x, s.y, s.direction)
        cocoEl.setAttribute('data-placed', '')
      }
    }
    handle = mountLeash(layer, options)
  }
  const h = handle
  cleanups.push(() => h.destroy())
  cleanups.push(
    onMotionChange((m) => {
      coco?.setMotion(m, rest)
      h.setMotion(m)
    }),
  )
  return () => {
    for (const c of cleanups.splice(0).reverse()) c()
  }
}
