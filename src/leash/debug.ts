import type { InspectableLeashHandle, LeashProbe } from './runtime'
import type { SpritePose } from './types'

// Test- und QA-Schnittstellen (DESIGN §9.13, KUNST-QA §3.1), nur im Debug-Build (`NEXT_PUBLIC_LEASH_DEBUG=1`):
// - `window.__leash`: `geometry`, `drawnLen()`, `cocoLen()`, `tier()`, `pose()`, `rebuildCount()`, `setReadingY(y)`;
// - `window.__qa`: Frame-Logger (`frames`, `loaf`, `longtasks`, `shifts`, `events`, `poseLog`, `marks`, `start()`,
//   `stop()`, `dump()`).
// Geladen nur über die Bedingung in `src/components/leash/LeashLayer.tsx`; ohne das Flag entfernt der Build den Import
// samt Chunk – `pnpm check:no-debug` prüft, dass `__leash`/`__qa` im Produktions-Build nicht vorkommen.

export interface LeashDebugApi {
  readonly geometry: ReturnType<InspectableLeashHandle['inspect']>['geometry']
  preset(): string
  drawnLen(): number
  cocoLen(): number
  tier(): 'A' | 'B' | 'C'
  pose(): SpritePose | null
  rebuildCount(): number
  /** Lesezeile fest setzen (px relativ zur Linien-Ebene); `null` = wieder dem Scroll folgen. */
  setReadingY(y: number | null): void
}

export interface PoseLogEntry {
  t: number
  from: SpritePose | null
  to: SpritePose
  bridge: string | null
}

export interface QaApi {
  frames: number[]
  loaf: PerformanceEntry[]
  longtasks: PerformanceEntry[]
  shifts: PerformanceEntry[]
  events: PerformanceEntry[]
  poseLog: PoseLogEntry[]
  readonly marks: PerformanceEntry[]
  readonly recording: boolean
  start(): void
  stop(): void
  dump(): QaDump
}

export interface QaDump {
  frames: number[]
  loaf: unknown[]
  longtasks: unknown[]
  shifts: unknown[]
  events: unknown[]
  poseLog: PoseLogEntry[]
  marks: unknown[]
}

type DebugWindow = Window & { __leash?: LeashDebugApi; __qa?: QaApi }

const MARKS = ['leash:build', 'leash:frame'] as const

function toJson(e: PerformanceEntry): unknown {
  return typeof (e as { toJSON?: () => unknown }).toJSON === 'function'
    ? (e as { toJSON: () => unknown }).toJSON()
    : { name: e.name, entryType: e.entryType, startTime: e.startTime, duration: e.duration }
}

/** Frame-Logger `window.__qa` (KUNST-QA §3.1). Beobachter laufen nur zwischen `start()` und `stop()`. */
export function createQa(win: Window = window): QaApi & { destroy(): void } {
  let rafId: number | null = null
  let observers: PerformanceObserver[] = []
  const observe = (type: string, into: PerformanceEntry[], extra: Record<string, unknown> = {}) => {
    try {
      const o = new PerformanceObserver((list) => into.push(...list.getEntries()))
      o.observe({ type, buffered: false, ...extra } as PerformanceObserverInit)
      observers.push(o)
    } catch {
      // Eintragsart vom Browser nicht unterstützt (z. B. `long-animation-frame` außerhalb von Chromium).
    }
  }
  const qa: QaApi & { destroy(): void } = {
    frames: [],
    loaf: [],
    longtasks: [],
    shifts: [],
    events: [],
    poseLog: [],
    get marks() {
      return MARKS.flatMap((n) => win.performance.getEntriesByName(n))
    },
    get recording() {
      return rafId !== null
    },
    start() {
      qa.stop()
      qa.frames = []
      qa.loaf = []
      qa.longtasks = []
      qa.shifts = []
      qa.events = []
      qa.poseLog = []
      for (const n of MARKS) win.performance.clearMeasures(n)
      observe('long-animation-frame', qa.loaf)
      observe('longtask', qa.longtasks)
      observe('layout-shift', qa.shifts)
      observe('event', qa.events, { durationThreshold: 16 })
      const tick = (t: number) => {
        qa.frames.push(t)
        rafId = win.requestAnimationFrame(tick)
      }
      rafId = win.requestAnimationFrame(tick)
    },
    stop() {
      if (rafId !== null) win.cancelAnimationFrame(rafId)
      rafId = null
      for (const o of observers) o.disconnect()
      observers = []
    },
    dump: () => ({
      frames: [...qa.frames],
      loaf: qa.loaf.map(toJson),
      longtasks: qa.longtasks.map(toJson),
      shifts: qa.shifts.map(toJson),
      events: qa.events.map(toJson),
      poseLog: [...qa.poseLog],
      marks: qa.marks.map(toJson),
    }),
    destroy() {
      qa.stop()
    },
  }
  return qa
}

/** Hängt `window.__leash` und `window.__qa` an den Griff der Linie; gibt die Abmeldung zurück. */
export function exposeLeashDebug(handle: InspectableLeashHandle, win: Window = window): () => void {
  const w = win as DebugWindow
  // `__qa` überlebt Routenwechsel (Aufnahmen über mehrere Seiten); neu angelegt nur beim ersten Mal.
  const qa = w.__qa ?? (w.__qa = createQa(win))
  const measure = (name: string, start: number, end: number) => {
    try {
      win.performance.measure(name, { start, end })
    } catch {
      // `performance.measure` mit Optionen fehlt (alte Engines) – dann ohne Marken.
    }
  }
  const probe: LeashProbe = {
    build: (start, end) => measure('leash:build', start, end),
    frame: (start, end) => {
      if (qa.recording) measure('leash:frame', start, end)
    },
    pose: (entry) => {
      qa.poseLog.push(entry)
    },
  }
  handle.setProbe(probe)
  const api: LeashDebugApi = {
    get geometry() {
      return handle.inspect().geometry
    },
    preset: () => handle.inspect().preset,
    drawnLen: () => handle.inspect().drawnLen,
    cocoLen: () => handle.inspect().cocoLen,
    tier: () => handle.inspect().tier,
    pose: () => handle.inspect().pose,
    rebuildCount: () => handle.inspect().rebuildCount,
    setReadingY: (y) => handle.setReadingY(y),
  }
  w.__leash = api
  return () => {
    handle.setProbe(null)
    if (w.__leash === api) delete w.__leash
  }
}
