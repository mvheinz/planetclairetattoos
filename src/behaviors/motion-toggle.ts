import { getMotion, onMotionChange, type Motion } from '../leash/motion'

import type { BehaviorContext, Unmount } from './types'

// `data-behavior="motion-toggle"` (DESIGN §11.7, KO-04): Schalter „Animationen: an/aus“ mit `aria-pressed`
// (gedrückt = Animationen an). Standard ist die Systemeinstellung; steht sie auf „reduzieren“ und gibt es keine eigene
// Wahl, zeigt der Knopf „aus (Systemeinstellung)“. Ein Klick setzt `html[data-motion]` und speichert die Wahl **erst
// jetzt** in `localStorage['pc-motion']` (in `try/catch`, R-130 a, ARCHITEKTUR §8.7); das Inline-Skript `pc-motion`
// liest sie beim nächsten Laden. Im Modus `preview` nur im Speicher (kein Web-Storage).
// Markup: `<button data-behavior="motion-toggle" data-label-on data-label-off data-label-off-system hidden>…
// <span data-motion-state></span></button>` – ohne JavaScript verborgen, `mount` zeigt ihn.

export const MOTION_STORAGE_KEY = 'pc-motion'

/** Wahl in der Vorschau-Datei (nur im Speicher, bleibt über Hash-Seitenwechsel erhalten). */
let previewChoice: Motion | null = null

export function mount(root: Element, ctx: BehaviorContext = { mode: 'app' }): Unmount {
  const doc = root.ownerDocument
  const html = doc.documentElement
  const button = root as HTMLElement
  const stateEl = root.querySelector<HTMLElement>('[data-motion-state]')
  const labels = {
    on: button.getAttribute('data-label-on') ?? 'on',
    off: button.getAttribute('data-label-off') ?? 'off',
    offSystem: button.getAttribute('data-label-off-system') ?? 'off',
  }

  if (ctx.mode === 'preview' && previewChoice) html.setAttribute('data-motion', previewChoice)

  const render = () => {
    const on = getMotion(doc) === 'full'
    button.setAttribute('aria-pressed', String(on))
    const text = on
      ? labels.on
      : html.getAttribute('data-motion') === 'reduced'
        ? labels.off
        : labels.offSystem
    if (stateEl) stateEl.textContent = text
  }

  const onClick = (event: Event) => {
    event.preventDefault()
    const next: Motion = getMotion(doc) === 'full' ? 'reduced' : 'full'
    html.setAttribute('data-motion', next)
    if (ctx.mode === 'preview') {
      previewChoice = next
    } else {
      try {
        doc.defaultView?.localStorage.setItem(MOTION_STORAGE_KEY, next)
      } catch {
        // Speicher gesperrt (privater Modus o. ä.): Wahl gilt nur für diese Seite.
      }
    }
    render()
  }

  button.addEventListener('click', onClick)
  const stopWatching = onMotionChange(render, doc)
  render()
  button.hidden = false

  return () => {
    button.removeEventListener('click', onClick)
    stopWatching()
  }
}
