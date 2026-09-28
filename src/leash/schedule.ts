// Ladezeitpunkt der Linien-Laufzeit (DESIGN §9.2, §9.10): nach dem LCP + 300 ms, spätestens `load` + 1200 ms, dann
// `requestIdleCallback` (timeout 500). Nach dem ersten Mal (weiche Navigation) nur noch Idle. Framework-frei und klein,
// weil es im Erstlade-Bundle der Hülle `LeashLayer` liegt.

let firstDone = false

type IdleWin = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
  cancelIdleCallback?: (id: number) => void
}

/** Ruft `cb` einmal zum passenden Zeitpunkt; gibt eine Abbruch-Funktion zurück. */
export function whenLeashReady(cb: () => void, win: Window = window): () => void {
  const w = win as IdleWin
  let done = false
  let idleId: number | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let observer: PerformanceObserver | null = null
  const cleanups: (() => void)[] = []

  const idle = () => {
    if (done) return
    done = true
    firstDone = true
    stopWaiting()
    if (w.requestIdleCallback) idleId = w.requestIdleCallback(() => cb(), { timeout: 500 })
    else timer = setTimeout(cb, 1)
  }
  let deadline = Infinity
  // Frühester Zeitpunkt gewinnt (LCP + 300 ms oder load + 1200 ms).
  const after = (ms: number) => {
    const due = performance.now() + ms
    if (done || due >= deadline) return
    deadline = due
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      idle()
    }, ms)
  }
  const stopWaiting = () => {
    observer?.disconnect()
    observer = null
    for (const c of cleanups.splice(0)) c()
  }

  if (firstDone) idle()
  else {
    try {
      observer = new PerformanceObserver((list) => {
        if (list.getEntries().length > 0) after(300)
      })
      observer.observe({ type: 'largest-contentful-paint', buffered: true })
    } catch {
      observer = null
    }
    const onLoad = () => after(1200)
    if (win.document.readyState === 'complete') onLoad()
    else {
      win.addEventListener('load', onLoad, { once: true })
      cleanups.push(() => win.removeEventListener('load', onLoad))
    }
  }

  return () => {
    done = true
    stopWaiting()
    if (timer !== null) clearTimeout(timer)
    if (idleId !== null) w.cancelIdleCallback?.(idleId)
  }
}

/** Nur für Tests: Zustand „erste Seite geladen“ zurücksetzen. */
export function resetLeashSchedule(): void {
  firstDone = false
}
