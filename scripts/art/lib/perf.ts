import { median, quantile } from './lab'

// Auswertung der Tempo-Messung SC-18 (KUNST-QA §4.6, §5.6 PF-01 … PF-08; PLAN P9.4). Rein: Rohdaten eines Laufs
// (`__qa.dump()` plus Zeitmarken) → Kennzahlen; Median über die Läufe je Route und Modus; Gates relativ zur Grundlinie
// `?leash=off` plus absolute Grenzen für Skriptzeit und Long Tasks (Headless-Hinweis §4.6).

export const ENGINE_SCRIPTS = ['leash', 'coco', 'micro'] as const

export interface PerfEntryJson {
  name?: string
  entryType?: string
  startTime: number
  duration: number
  value?: number
  hadRecentInput?: boolean
  scripts?: {
    sourceURL?: string
    invoker?: string
    sourceFunctionName?: string
    duration?: number
  }[]
  sources?: { node?: unknown; previousRect?: unknown; currentRect?: unknown }[]
}

export interface QaDumpJson {
  frames: number[]
  loaf: PerfEntryJson[]
  longtasks: PerfEntryJson[]
  shifts: PerfEntryJson[]
  events: PerfEntryJson[]
  marks: PerfEntryJson[]
}

export interface RawRun {
  route: string
  mode: 'engine' | 'off'
  run: number
  marks: {
    lcp: number | null
    menuAt: number | null
    addAt: number | null
    scrollFrom: number
    scrollTo: number
  }
  dump: QaDumpJson
}

export interface RunMetrics {
  rafP50: number | null
  rafP95: number | null
  /** Anteil Frame-Intervalle > 33,4 ms (0–1). */
  rafOver33: number | null
  /** LoAF-Einträge > 50 ms gesamt bzw. mit Skript-Zuordnung zu leash/coco/micro. */
  loafOver50: number
  loafEngine: number
  loafEngineBy: Record<(typeof ENGINE_SCRIPTS)[number], number>
  longtasks: number
  leashFrameP95: number | null
  leashBuild: number | null
  leashBuildMax: number | null
  cls: number
  clsSources: number
  menuEventMs: number | null
  addEventMs: number | null
  lcp: number | null
}

const round = (v: number | null, d = 2) => (v === null ? null : Math.round(v * 10 ** d) / 10 ** d)

/** rAF-Intervalle aus Zeitstempeln. */
export function intervals(frames: readonly number[]): number[] {
  const out: number[] = []
  for (let i = 1; i < frames.length; i++) out.push(frames[i]! - frames[i - 1]!)
  return out
}

/** Skript-Zuordnung eines LoAF-Eintrags (Chunk-/Quellname enthält `leash`, `coco` bzw. `micro`/`behaviors`). */
export function engineScripts(entry: PerfEntryJson): (typeof ENGINE_SCRIPTS)[number][] {
  const hits = new Set<(typeof ENGINE_SCRIPTS)[number]>()
  for (const s of entry.scripts ?? []) {
    const src =
      `${s.sourceURL ?? ''} ${s.sourceFunctionName ?? ''} ${s.invoker ?? ''}`.toLowerCase()
    if (src.includes('leash')) hits.add('leash')
    if (src.includes('coco')) hits.add('coco')
    if (src.includes('micro') || src.includes('behaviors')) hits.add('micro')
  }
  return [...hits]
}

/** Längstes Event-Timing (ms) im Fenster `[from, from + windowMs]`. */
export function eventIn(
  events: readonly PerfEntryJson[],
  from: number | null,
  windowMs = 1500,
): number | null {
  if (from === null) return null
  const hits = events.filter((e) => e.startTime >= from - 5 && e.startTime <= from + windowMs)
  return hits.length ? Math.max(...hits.map((e) => e.duration)) : null
}

export function runMetrics(raw: RawRun): RunMetrics {
  const iv = intervals(raw.dump.frames)
  const loaf50 = raw.dump.loaf.filter((e) => e.duration > 50)
  const by = { leash: 0, coco: 0, micro: 0 }
  let engine = 0
  for (const e of loaf50) {
    const s = engineScripts(e)
    if (s.length) engine++
    for (const k of s) by[k]++
  }
  const frameMarks = raw.dump.marks.filter((m) => m.name === 'leash:frame').map((m) => m.duration)
  const builds = raw.dump.marks.filter((m) => m.name === 'leash:build').map((m) => m.duration)
  const shifts = raw.dump.shifts.filter((s) => !s.hadRecentInput)
  return {
    rafP50: round(median(iv)),
    rafP95: round(quantile(iv, 0.95)),
    rafOver33: iv.length ? round(iv.filter((d) => d > 33.4).length / iv.length, 4) : null,
    loafOver50: loaf50.length,
    loafEngine: engine,
    loafEngineBy: by,
    longtasks: raw.dump.longtasks.filter((e) => e.duration > 50).length,
    leashFrameP95: round(quantile(frameMarks, 0.95), 3),
    leashBuild: round(median(builds), 3),
    leashBuildMax: builds.length ? round(Math.max(...builds), 3) : null,
    cls:
      round(
        shifts.reduce((a, s) => a + (s.value ?? 0), 0),
        4,
      ) ?? 0,
    clsSources: shifts.reduce((a, s) => a + (s.sources?.length ?? 0), 0),
    menuEventMs: eventIn(raw.dump.events, raw.marks.menuAt),
    addEventMs: eventIn(raw.dump.events, raw.marks.addAt),
    lcp: round(raw.marks.lcp, 1),
  }
}

/** Median je Kennzahl über mehrere Läufe (`null` wird übersprungen). */
export function medianMetrics(runs: readonly RunMetrics[]): RunMetrics {
  const num = (k: keyof RunMetrics) => {
    const vals = runs.map((r) => r[k]).filter((v): v is number => typeof v === 'number')
    return round(median(vals), 4)
  }
  return {
    rafP50: num('rafP50'),
    rafP95: num('rafP95'),
    rafOver33: num('rafOver33'),
    loafOver50: num('loafOver50') ?? 0,
    loafEngine: num('loafEngine') ?? 0,
    loafEngineBy: {
      leash: median(runs.map((r) => r.loafEngineBy.leash)) ?? 0,
      coco: median(runs.map((r) => r.loafEngineBy.coco)) ?? 0,
      micro: median(runs.map((r) => r.loafEngineBy.micro)) ?? 0,
    },
    longtasks: num('longtasks') ?? 0,
    leashFrameP95: num('leashFrameP95'),
    leashBuild: num('leashBuild'),
    leashBuildMax: num('leashBuildMax'),
    cls: num('cls') ?? 0,
    clsSources: num('clsSources') ?? 0,
    menuEventMs: num('menuEventMs'),
    addEventMs: num('addEventMs'),
    lcp: num('lcp'),
  }
}

/** `Layout`-Ereignisse im Trace (Chrome-Trace-JSON, `traceEvents`). */
export function countLayoutEvents(trace: {
  traceEvents?: { name?: string; ph?: string }[]
}): number {
  return (trace.traceEvents ?? []).filter((e) => e.name === 'Layout' && e.ph !== 'E').length
}

export interface Gate {
  id: string
  route: string
  pass: boolean
  value: number | null
  limit: string
}

/** Gates (KUNST-QA §5.6): relativ zur Grundlinie (`off`) plus absolute Grenzen für Skriptzeit und Long Tasks. */
export function perfGates(
  route: string,
  engine: RunMetrics,
  off: RunMetrics,
  layoutEvents: number | null,
): Gate[] {
  const g = (id: string, pass: boolean, value: number | null, limit: string): Gate => ({
    id,
    route,
    pass,
    value,
    limit,
  })
  const d = (a: number | null, b: number | null) =>
    a === null || b === null ? null : round(a - b, 3)
  const dP95 = d(engine.rafP95, off.rafP95)
  const dOver = d(engine.rafOver33, off.rafOver33)
  const dLcp = d(engine.lcp, off.lcp)
  return [
    g('PF-01', engine.loafEngine === 0, engine.loafEngine, '0 LoAF > 50 ms aus leash/coco/micro'),
    g('PF-02a', dP95 === null || dP95 <= 3, dP95, 'p95 rAF ≤ Grundlinie + 3 ms'),
    g('PF-02b', dOver === null || dOver <= 0.03, dOver, 'Anteil > 33,4 ms ≤ Grundlinie + 3 pp'),
    g(
      'PF-03',
      engine.leashFrameP95 === null || engine.leashFrameP95 <= 6,
      engine.leashFrameP95,
      'leash:frame p95 ≤ 6 ms (4×)',
    ),
    g(
      'PF-04',
      engine.leashBuildMax === null || engine.leashBuildMax <= 50,
      engine.leashBuildMax,
      'leash:build ≤ 50 ms je Aufbau (4×)',
    ),
    g(
      'PF-05',
      layoutEvents === null || layoutEvents <= 3,
      layoutEvents,
      '≤ 3 Layout-Ereignisse in 5 s Scrollen',
    ),
    g(
      'PF-06',
      engine.cls <= off.cls + 0.001,
      d(engine.cls, off.cls),
      'CLS mit Engine ≤ Grundlinie',
    ),
    g('PF-07', dLcp === null || dLcp <= 100, dLcp, 'LCP mit Engine − Grundlinie ≤ 100 ms'),
    g(
      'PF-08',
      [engine.menuEventMs, engine.addEventMs].every((v) => v === null || v <= 150),
      Math.max(engine.menuEventMs ?? 0, engine.addEventMs ?? 0) || null,
      'Event-Timing Menü/„In den Korb“ ≤ 150 ms',
    ),
  ]
}
