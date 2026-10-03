// Lädt Nachrangiges erst nach dem `load`-Ereignis im Leerlauf (z. B. spätere Formularschritte, Bild-Upload), damit es
// nicht zum JS beim ersten Laden zählt (Budget firstLoadJs, tests/perf/budgets.json; DESIGN §9.10). Gibt eine
// Abbruch-Funktion zurück.

type IdleWin = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
  cancelIdleCallback?: (id: number) => void
}

export function afterLoad(cb: () => void, win: Window = window): () => void {
  const w = win as IdleWin
  let cancelled = false
  let idleId: number | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  const run = () => {
    if (cancelled) return
    if (w.requestIdleCallback) idleId = w.requestIdleCallback(cb, { timeout: 1000 })
    else timer = setTimeout(cb, 1)
  }
  if (win.document.readyState === 'complete') run()
  else win.addEventListener('load', run, { once: true })
  return () => {
    cancelled = true
    win.removeEventListener('load', run)
    if (idleId !== null) w.cancelIdleCallback?.(idleId)
    if (timer !== null) clearTimeout(timer)
  }
}
