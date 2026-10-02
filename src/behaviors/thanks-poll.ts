import type { BehaviorContext, Unmount } from './types'

// `data-behavior="thanks-poll"` (KONZEPT §4.12, PLAN P4.17): Danke-Seite im Zustand „wartet“ (Kasse `confirming`, noch
// keine Bestellung). Fragt alle 2 s bis 60 s `GET /api/checkout/[token]/state` ab (über `ctx.actions.thanksState`, das
// Modul selbst enthält keinen Netzcode) und lädt die Seite neu, sobald der Zustandscode vom Ausgangszustand
// (`data-state`, Standard `waiting`) abweicht. Nach 60 s endet die Abfrage und `[data-thanks-long]` („Das dauert länger
// als sonst …“) wird sichtbar. Im Modus `preview` aus. Keine Cookies, kein Web-Storage.

export const POLL_INTERVAL_MS = 2000
export const POLL_MAX_MS = 60_000

/** Austauschbar für Tests (jsdom kann nicht neu laden). */
export const navigation = {
  reload(win: Window): void {
    win.location.reload()
  },
}

export function mount(root: Element, ctx: BehaviorContext = { mode: 'app' }): Unmount {
  const el = root as HTMLElement
  const long = () => el.querySelector<HTMLElement>('[data-thanks-long]')
  const url = el.getAttribute('data-state-url') ?? ''
  const fetchState = ctx.actions?.thanksState
  if (ctx.mode === 'preview' || !fetchState || !url) return () => {}

  const win = el.ownerDocument.defaultView
  const initial = el.getAttribute('data-state') || 'waiting'
  let timer: ReturnType<typeof setTimeout> | null = null
  let controller: AbortController | null = null
  let stopped = false
  let elapsed = 0

  const stop = () => {
    stopped = true
    if (timer !== null) clearTimeout(timer)
    timer = null
    controller?.abort()
    controller = null
  }

  const giveUp = () => {
    stop()
    const note = long()
    if (note) note.hidden = false
  }

  const tick = async () => {
    timer = null
    elapsed += POLL_INTERVAL_MS
    controller = new AbortController()
    let code: string | null = null
    try {
      code = await fetchState(url, controller.signal)
    } catch {
      code = null
    }
    controller = null
    if (stopped) return
    if (code && code !== initial) {
      stop()
      if (win) navigation.reload(win)
      return
    }
    if (elapsed >= POLL_MAX_MS) giveUp()
    else schedule()
  }

  const schedule = () => {
    if (!stopped) timer = setTimeout(() => void tick(), POLL_INTERVAL_MS)
  }

  schedule()
  return stop
}
