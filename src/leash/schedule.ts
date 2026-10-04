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
  // Frühester Zeitpunkt gewinnt (LCP + 300 ms oder load + 1200 ms); der LCP zählt ab seinem letzten Kandidaten
  // (`startTime`) – spätere, größere Kandidaten schieben den Start nach hinten (R2-02-01).
  let lcpDue = Infinity
  let loadDue = Infinity
  const plan = () => {
    if (done) return
    const due = Math.min(lcpDue, loadDue)
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(
      () => {
        timer = null
        idle()
      },
      Math.max(0, due - performance.now()),
    )
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
        const e = list.getEntries().at(-1)
        if (!e) return
        lcpDue = e.startTime + 300
        plan()
      })
      observer.observe({ type: 'largest-contentful-paint', buffered: true })
    } catch {
      observer = null
    }
    const onLoad = () => {
      loadDue = performance.now() + 1200
      plan()
    }
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
