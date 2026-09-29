import { mountCoco, type CocoController } from '../leash/coco'
import { getMotion, onMotionChange } from '../leash/motion'

import { SOLD_EVENT, type BehaviorContext, type SoldEventDetail, type Unmount } from './types'

// `data-behavior="thanks-moment"` (DESIGN KO-19, MI-09, Grundfassung P4.17): Danke-Seite „bezahlt“. Nach der Linie
// (900 ms) und dem Herz (400 ms) rollt sich Coco ein (`sitzen → einrollen-1 → einrollen-2 → schlafen`, Brücken aus
// `src/leash/coco.ts`), atmet einmal 2,4 s (`data-breathe`) und die Mini-Preisschilder bekommen ihren Stempel-Knall
// (MI-03: Ereignis `SOLD_EVENT` je `data-product-id`, abgespielt vom Modul `sold-stamp`, höchstens 3 Knalle). Gesamt
// ≤ 5 s. Reduzierte Bewegung (auch nachträglich): sofort der Endzustand – Coco schläft, Stempel stehen statisch. Kein
// Netz, kein Speicher.

export const LINE_MS = 900
export const HEART_MS = 400
export const BREATHE_MS = 2400

export function mount(root: Element, ctx: BehaviorContext = { mode: 'app' }): Unmount {
  void ctx
  const doc = root.ownerDocument
  const cocoEl = root.querySelector<HTMLElement>('[data-thanks-coco]')
  const productIds = Array.from(root.querySelectorAll<HTMLElement>('[data-product-id]'))
    .map((el) => el.getAttribute('data-product-id'))
    .filter((id): id is string => !!id)
  const timers = new Set<ReturnType<typeof setTimeout>>()
  let coco: CocoController | null = null
  let done = false

  const later = (ms: number, fn: () => void) => {
    const t = setTimeout(() => {
      timers.delete(t)
      fn()
    }, ms)
    timers.add(t)
  }

  const clearTimers = () => {
    for (const t of timers) clearTimeout(t)
    timers.clear()
  }

  /** Endzustand: Coco schläft, Stempel sichtbar (ohne Knall). */
  const finish = () => {
    if (done) return
    done = true
    clearTimers()
    cocoEl?.removeAttribute('data-breathe')
    coco?.setMotion('reduced', 'schlafen')
    for (const stamp of Array.from(root.querySelectorAll<HTMLElement>('[data-sold-stamp]'))) {
      stamp.hidden = false
      stamp.closest('[data-price-tag]')?.setAttribute('data-sold', '')
    }
    root.setAttribute('data-thanks-done', '')
  }

  if (cocoEl) {
    const href = cocoEl.querySelector('use')?.getAttribute('href')?.split('#')[0]
    coco = mountCoco(cocoEl, {
      pose: 'sitzen',
      motion: getMotion(doc),
      ...(href !== undefined ? { href } : {}),
    })
  }

  if (getMotion(doc) === 'reduced') finish()
  else {
    later(LINE_MS + HEART_MS, () => {
      coco?.setPose('schlafen')
      for (const id of productIds) {
        doc.dispatchEvent(new CustomEvent<SoldEventDetail>(SOLD_EVENT, { detail: { id } }))
      }
      later(400, () => {
        cocoEl?.setAttribute('data-breathe', '')
        later(BREATHE_MS, () => {
          cocoEl?.removeAttribute('data-breathe')
          done = true
          root.setAttribute('data-thanks-done', '')
        })
      })
    })
  }

  const offMotion = onMotionChange((m) => {
    if (m === 'reduced') finish()
  }, doc)

  return () => {
    offMotion()
    clearTimers()
    cocoEl?.removeAttribute('data-breathe')
    coco?.destroy()
    coco = null
  }
}
