import { getMotion } from '../leash/motion'

import type { BehaviorContext, Unmount } from './types'

// `data-behavior="menu"` am `<dialog id="menu">` (DESIGN KO-03, §9.12, MI-05). Ohne JavaScript ist der Menü-Knopf
// ein Link auf `#fussnavigation`; `mount` macht aus jedem Auslöser (`[aria-controls="<id>"]`) einen Knopf, der das
// Menü modal öffnet: Fokus auf den ersten Link, Tab bleibt im Dialog, `Esc`/„Schließen“ schließen mit Fokus zurück auf
// den Auslöser, `<html data-menu-open>` sperrt das Scrollen ohne Verschiebung (`overflow: hidden`,
// `scrollbar-gutter: stable`). Ein Linkklick schließt sofort (ohne Animation) und navigiert. Bei reduzierter
// Bewegung keine Animationen (Endzustand sofort). Kein Netz, kein Speicher (auch nicht im Modus `app`).

const OPEN_MS = 420
const LINK_MS = 320
const CLOSE_MS = 180
const COCO_MS = 300
const COCO_DELAY = 200
const STAGGER_FALLBACK = 40
const EASE_FALLBACK = 'cubic-bezier(0.3, 0.7, 0.2, 1)'
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export const MENU_OPEN_ATTR = 'data-menu-open'

type DialogLike = HTMLElement & {
  open?: boolean
  showModal?: () => void
  close?: () => void
}

/** 0–20 ms Versatz je Link, stabil aus dem Index (MI-05 „Seed“). */
const seedOffset = (i: number) => (i * 7) % 21

export function mount(root: Element, _ctx: BehaviorContext = { mode: 'app' }): Unmount {
  const doc = root.ownerDocument
  const win = doc.defaultView
  const dialog = root as DialogLike
  const html = doc.documentElement
  const id = dialog.id || 'menu'
  const triggers = Array.from(doc.querySelectorAll<HTMLElement>(`[aria-controls="${id}"]`))
  const animations = new Set<Animation>()
  let lastTrigger: HTMLElement | null = null
  let closing = false

  const isOpen = () => dialog.open === true || dialog.hasAttribute('open')
  const reduced = () => getMotion(doc) === 'reduced'
  const cssVar = (name: string, fallback: string) =>
    win?.getComputedStyle(html).getPropertyValue(name).trim() || fallback

  const track = (anim: Animation | undefined) => {
    if (!anim) return
    animations.add(anim)
    const done = () => animations.delete(anim)
    anim.onfinish = done
    anim.oncancel = done
  }
  const cancelAll = () => {
    for (const a of Array.from(animations)) a.cancel()
    animations.clear()
  }

  const focusables = () =>
    Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => !el.closest('[hidden]'),
    )

  const setExpanded = (value: boolean) => {
    for (const t of triggers) t.setAttribute('aria-expanded', String(value))
  }

  const animateOpen = (trigger: HTMLElement | null) => {
    if (reduced() || typeof dialog.animate !== 'function') return
    const inkOut = cssVar('--ease-ink-out', EASE_FALLBACK)
    const stagger = Number.parseFloat(cssVar('--stagger', `${STAGGER_FALLBACK}ms`)) || 40
    const rect = trigger?.getBoundingClientRect()
    const x = rect ? rect.left + rect.width / 2 : (win?.innerWidth ?? 0)
    const y = rect ? rect.top + rect.height / 2 : 0
    track(
      dialog.animate(
        [
          { clipPath: `circle(0px at ${x}px ${y}px)` },
          { clipPath: `circle(150vmax at ${x}px ${y}px)` },
        ],
        { duration: OPEN_MS, easing: inkOut },
      ),
    )
    Array.from(dialog.querySelectorAll<HTMLElement>('[data-menu-item]')).forEach((item, i) => {
      track(
        item.animate(
          [
            { opacity: 0, transform: 'translateY(10px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          {
            duration: LINK_MS,
            delay: i * stagger + seedOffset(i),
            easing: inkOut,
            fill: 'backwards',
          },
        ),
      )
    })
    const coco = dialog.querySelector<HTMLElement>('[data-coco-slot]')
    if (coco) {
      track(
        coco.animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], {
          duration: COCO_MS,
          delay: COCO_DELAY,
          easing: inkOut,
          fill: 'backwards',
        }),
      )
    }
  }

  const open = (trigger: HTMLElement | null) => {
    if (isOpen()) return
    cancelAll()
    closing = false
    lastTrigger = trigger
    if (typeof dialog.showModal === 'function') dialog.showModal()
    else dialog.setAttribute('open', '')
    html.setAttribute(MENU_OPEN_ATTR, '')
    setExpanded(true)
    const first = dialog.querySelector<HTMLElement>('[data-menu-item] a[href]') ?? focusables()[0]
    first?.focus()
    animateOpen(trigger)
  }

  const finishClose = (restoreFocus: boolean) => {
    cancelAll()
    closing = false
    if (isOpen()) {
      if (typeof dialog.close === 'function') dialog.close()
      else dialog.removeAttribute('open')
    }
    html.removeAttribute(MENU_OPEN_ATTR)
    setExpanded(false)
    if (restoreFocus) (lastTrigger ?? triggers[0])?.focus()
  }

  const close = (animate: boolean) => {
    if (!isOpen() || closing) return
    if (!animate || reduced() || typeof dialog.animate !== 'function') {
      finishClose(true)
      return
    }
    closing = true
    cancelAll()
    const anim = dialog.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: CLOSE_MS,
      easing: cssVar('--ease-calm', 'cubic-bezier(0.2, 0, 0, 1)'),
    })
    track(anim)
    anim.onfinish = () => {
      animations.delete(anim)
      finishClose(true)
    }
  }

  const onTriggerClick = (event: Event) => {
    event.preventDefault()
    open(event.currentTarget as HTMLElement)
  }
  const onTriggerKey = (event: KeyboardEvent) => {
    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault()
      open(event.currentTarget as HTMLElement)
    }
  }

  const onDialogKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close(true)
      return
    }
    if (event.key !== 'Tab') return
    // Eigene Tab-Reihenfolge: bleibt im Dialog und schließt Links ein (auch in Safari, das Links sonst überspringt).
    const items = focusables()
    if (items.length === 0) return
    event.preventDefault()
    const index = items.indexOf(doc.activeElement as HTMLElement)
    const step = event.shiftKey ? -1 : 1
    const next = index < 0 ? (event.shiftKey ? items.length - 1 : 0) : index + step
    items[(next + items.length) % items.length]!.focus()
  }

  // Natives `cancel` (Esc) → eigene Schließ-Logik; `close` von außen (z. B. Formular) → aufräumen.
  const onCancel = (event: Event) => {
    event.preventDefault()
    close(true)
  }
  const onClose = () => {
    if (html.hasAttribute(MENU_OPEN_ATTR)) finishClose(false)
  }

  const onDialogClick = (event: Event) => {
    const target = event.target as Element | null
    if (target?.closest('[data-menu-close-button]')) {
      event.preventDefault()
      close(true)
      return
    }
    // Linkklick: sofort schließen (ohne Animation), Navigation läuft weiter.
    if (target?.closest('a[href]')) finishClose(false)
  }

  for (const t of triggers) {
    t.setAttribute('role', 'button')
    t.setAttribute('aria-expanded', 'false')
    t.addEventListener('click', onTriggerClick)
    t.addEventListener('keydown', onTriggerKey)
  }
  dialog.addEventListener('keydown', onDialogKey)
  dialog.addEventListener('cancel', onCancel)
  dialog.addEventListener('close', onClose)
  dialog.addEventListener('click', onDialogClick)

  return () => {
    for (const t of triggers) {
      t.removeEventListener('click', onTriggerClick)
      t.removeEventListener('keydown', onTriggerKey)
      t.removeAttribute('role')
      t.setAttribute('aria-expanded', 'false')
    }
    dialog.removeEventListener('keydown', onDialogKey)
    dialog.removeEventListener('cancel', onCancel)
    dialog.removeEventListener('close', onClose)
    dialog.removeEventListener('click', onDialogClick)
    if (isOpen() || html.hasAttribute(MENU_OPEN_ATTR)) finishClose(false)
    cancelAll()
  }
}
