import { TOUR_ANCHOR } from '../lib/routes/anchors'

import type { BehaviorContext, Unmount } from './types'

// `data-behavior="tour-fold"` (U-51, P14.2): Schaukasten „Planet Claire on Tour“ auf der Startseite. Unter 1100 px ist er
// ein zugeklapptes `<details>` hinter Station 01; ab 1100 px steht er offen oben rechts. Das CSS zeigt den Inhalt am Desktop
// schon vor dem Laden (`::details-content`); dieses Modul setzt dort zusätzlich `open`, damit der Zustand auch für
// Screenreader stimmt (WebKit legt zugeklappte Inhalte sonst nicht in den Barrierefreiheitsbaum). V-60: Kommt jemand über
// die Kurzadresse `/on-tour` (→ `/de#on-tour`), klappt das Modul den Schaukasten auch am Handy auf (ebenso bei einem
// späteren Sprung auf `#on-tour`). Kein Netz, kein Speicher.

export const DESKTOP_QUERY = '(min-width: 1100px)'

export function mount(root: Element, ctx: BehaviorContext = { mode: 'app' }): Unmount {
  void ctx
  const details = root as HTMLDetailsElement
  const win = details.ownerDocument.defaultView
  const mq = win?.matchMedia?.(DESKTOP_QUERY)
  if (!mq) return () => {}
  const wanted = () => win?.location.hash === `#${TOUR_ANCHOR}`
  if (mq.matches || wanted()) details.open = true
  // Wechsel der Breite (Drehen, Fenster): am Desktop offen, darunter wieder eingeklappt
  const onChange = () => {
    details.open = mq.matches
  }
  const onHash = () => {
    if (wanted()) details.open = true
  }
  mq.addEventListener('change', onChange)
  win?.addEventListener('hashchange', onHash)
  return () => {
    mq.removeEventListener('change', onChange)
    win?.removeEventListener('hashchange', onHash)
  }
}
