import type { BehaviorContext, Unmount } from './types'

// `data-behavior="tour-fold"` (U-51, P14.2): Schaukasten „Planet Claire on Tour“ auf der Startseite. Unter 1100 px ist er
// ein zugeklapptes `<details>` hinter Station 01; ab 1100 px steht er offen oben rechts. Das CSS zeigt den Inhalt am Desktop
// schon vor dem Laden (`::details-content`); dieses Modul setzt dort zusätzlich `open`, damit der Zustand auch für
// Screenreader stimmt (WebKit legt zugeklappte Inhalte sonst nicht in den Barrierefreiheitsbaum). Kein Netz, kein Speicher.

export const DESKTOP_QUERY = '(min-width: 1100px)'

export function mount(root: Element, ctx: BehaviorContext = { mode: 'app' }): Unmount {
  void ctx
  const details = root as HTMLDetailsElement
  const win = details.ownerDocument.defaultView
  const mq = win?.matchMedia?.(DESKTOP_QUERY)
  if (!mq) return () => {}
  if (mq.matches) details.open = true
  // Wechsel der Breite (Drehen, Fenster): am Desktop offen, darunter wieder eingeklappt
  const onChange = () => {
    details.open = mq.matches
  }
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}
