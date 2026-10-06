import type { InspectableLeashHandle, LeashProbe } from './runtime'
import type { SpritePose } from './types'

// Test- und QA-Schnittstellen (DESIGN §9.13, KUNST-QA §3.1), nur im Debug-Build (`NEXT_PUBLIC_LEASH_DEBUG=1`):
// - `window.__leash`: `geometry`, `drawnLen()`, `cocoLen()`, `tier()`, `pose()`, `rebuildCount()`, `setReadingY(y)`;
// - `window.__qa`: Frame-Logger (`frames`, `loaf`, `longtasks`, `shifts`, `events`, `poseLog`, `marks`, `start()`,
//   `stop()`, `dump()`). `marks` sammelt die User-Timing-Messungen `leash:build`/`leash:frame`, die die Engine immer
//   setzt (`LEASH_MEASURES` in `runtime.ts`), per `PerformanceObserver` zwischen `start()` und `stop()`.
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
  marks: PerformanceEntry[]
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

/** Namen wie `LEASH_MEASURES` in `runtime.ts` (hier als Literal, damit der Debug-Chunk nur Typen importiert). */
const MARKS = ['leash:build', 'leash:frame'] as const

function toJson(e: PerformanceEntry): unknown {
  return typeof (e as { toJSON?: () => unknown }).toJSON === 'function'
    ? (e as { toJSON: () => unknown }).toJSON()
    : { name: e.name, entryType: e.entryType, startTime: e.startTime, duration: e.duration }
}

/** Frame-Logger `window.__qa` (KUNST-QA §3.1). Beobachter laufen nur zwischen `start()` und `stop()`. */
export function createQa(win: Window = window): QaApi & { destroy(): void } {
  let rafId: number | null = null
  let observers: { o: PerformanceObserver; take(): void }[] = []
  const observe = (
    type: string,
    into: () => PerformanceEntry[],
    extra: Record<string, unknown> = {},
    keep: (e: PerformanceEntry) => boolean = () => true,
  ) => {
    const add = (entries: PerformanceEntryList) => into().push(...entries.filter(keep))
    try {
      const o = new PerformanceObserver((list) => add(list.getEntries()))
      o.observe({ type, buffered: false, ...extra } as PerformanceObserverInit)
      observers.push({ o, take: () => add(o.takeRecords()) })
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
    marks: [],
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
      qa.marks = []
      observe('long-animation-frame', () => qa.loaf)
      observe('longtask', () => qa.longtasks)
      observe('layout-shift', () => qa.shifts)
      observe('event', () => qa.events, { durationThreshold: 16 })
      observe(
        'measure',
        () => qa.marks,
        {},
        (e) => MARKS.some((n) => n === e.name),
      )
      const tick = (t: number) => {
        qa.frames.push(t)
        rafId = win.requestAnimationFrame(tick)
      }
      rafId = win.requestAnimationFrame(tick)
    },
    stop() {
      if (rafId !== null) win.cancelAnimationFrame(rafId)
      rafId = null
      // Noch nicht zugestellte Einträge übernehmen, dann abmelden.
      for (const { o, take } of observers) {
        take()
        o.disconnect()
      }
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

/**
 * Nur der Frame-Logger `window.__qa` – auch ohne Linie (Seiten ohne Preset, `?leash=off` als Grundlinie der
 * Tempo-Messung SC-18, KUNST-QA §4.6).
 */
export function exposeQa(win: Window = window): QaApi {
  const w = win as DebugWindow
  return w.__qa ?? (w.__qa = createQa(win))
}

/** Hängt `window.__leash` und `window.__qa` an den Griff der Linie; gibt die Abmeldung zurück. */
export function exposeLeashDebug(handle: InspectableLeashHandle, win: Window = window): () => void {
  const w = win as DebugWindow
  // `__qa` überlebt Routenwechsel (Aufnahmen über mehrere Seiten); neu angelegt nur beim ersten Mal.
  const qa = exposeQa(win)
  const probe: LeashProbe = {
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
