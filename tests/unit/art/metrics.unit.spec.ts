import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  countLayoutEvents,
  engineScripts,
  eventIn,
  intervals,
  medianMetrics,
  perfGates,
  runMetrics,
  type RawRun,
} from '../../../scripts/art/lib/perf'
import { buildPerfReport } from '../../../scripts/art/metrics'

// P9.4 Tempo-Auswertung SC-18 (KUNST-QA §4.6, §5.6): Kennzahlen je Lauf, Median über Läufe, Gates relativ zur
// Grundlinie `?leash=off`. Beispiel-JSONs: aufgezeichnete Läufe (Pixel 7, CPU 4×) unter `tests/fixtures/art/`.

const fixture = (name: string) =>
  JSON.parse(readFileSync(path.join('tests/fixtures/art', name), 'utf8')) as RawRun

const synthetic = (
  over: Partial<RawRun['dump']> = {},
  marks: Partial<RawRun['marks']> = {},
): RawRun => ({
  route: 'R01',
  mode: 'engine',
  run: 1,
  marks: { lcp: 1200, menuAt: 1000, addAt: null, scrollFrom: 0, scrollTo: 5000, ...marks },
  dump: { frames: [], loaf: [], longtasks: [], shifts: [], events: [], marks: [], ...over },
})

describe('P9.4 Kennzahlen eines Laufs', () => {
  it('P9.4 rAF-Intervalle p50/p95 und Anteil > 33,4 ms', () => {
    const frames = [0, 16, 32, 48, 64, 80, 96, 112, 128, 144, 194]
    expect(intervals(frames)).toEqual([16, 16, 16, 16, 16, 16, 16, 16, 16, 50])
    const m = runMetrics(synthetic({ frames }))
    expect(m.rafP50).toBe(16)
    expect(m.rafP95).toBe(16)
    expect(m.rafOver33).toBe(0.1)
  })

  it('P9.4 LoAF > 50 ms mit Skript-Zuordnung leash/coco/micro', () => {
    const loaf = [
      {
        startTime: 1,
        duration: 80,
        scripts: [{ sourceURL: '/_next/static/chunks/leash-runtime.js' }],
      },
      {
        startTime: 2,
        duration: 60,
        scripts: [{ sourceURL: '/x.js', sourceFunctionName: 'mountCoco' }],
      },
      { startTime: 3, duration: 70, scripts: [{ sourceURL: '/_next/static/chunks/app.js' }] },
      { startTime: 4, duration: 40, scripts: [{ sourceURL: '/leash.js' }] },
    ]
    expect(engineScripts(loaf[0]!)).toEqual(['leash'])
    const m = runMetrics(synthetic({ loaf }))
    expect(m.loafOver50).toBe(3)
    expect(m.loafEngine).toBe(2)
    expect(m.loafEngineBy).toEqual({ leash: 1, coco: 1, micro: 0 })
  })

  it('P9.4 leash:frame p95, leash:build, CLS ohne Eingabe, Event-Timing im Fenster', () => {
    const marks = [
      ...Array.from({ length: 20 }, (_, i) => ({
        name: 'leash:frame',
        startTime: i,
        duration: i < 19 ? 1 : 9,
      })),
      { name: 'leash:build', startTime: 0, duration: 12 },
    ]
    const shifts = [
      { startTime: 1, duration: 0, value: 0.02, sources: [{}] },
      { startTime: 2, duration: 0, value: 0.5, hadRecentInput: true },
    ]
    const events = [
      { name: 'click', startTime: 1010, duration: 48 },
      { name: 'click', startTime: 4000, duration: 300 },
    ]
    const m = runMetrics(synthetic({ marks, shifts, events }))
    expect(m.leashFrameP95).toBe(1)
    expect(m.leashBuild).toBe(12)
    expect(m.cls).toBe(0.02)
    expect(m.clsSources).toBe(1)
    expect(m.menuEventMs).toBe(48)
    expect(eventIn(events, null)).toBeNull()
  })

  it('P9.4 Layout-Ereignisse im Trace', () => {
    expect(
      countLayoutEvents({
        traceEvents: [
          { name: 'Layout', ph: 'X' },
          { name: 'Layout', ph: 'B' },
          { name: 'Layout', ph: 'E' },
          { name: 'Paint' },
        ],
      }),
    ).toBe(2)
  })
})

describe('P9.4 Gates relativ zur Grundlinie', () => {
  it('P9.4 PF-02 relativ: +3 ms p95 erlaubt, mehr nicht; PF-01 absolut 0', () => {
    const base = medianMetrics([runMetrics(synthetic({ frames: [0, 16, 32, 48, 64] }))])
    const ok = { ...base, rafP95: (base.rafP95 ?? 0) + 3 }
    const bad = { ...base, rafP95: (base.rafP95 ?? 0) + 3.5, loafEngine: 1 }
    const okGates = perfGates('R01', ok, base, 2)
    expect(okGates.every((g) => g.pass)).toBe(true)
    const badGates = perfGates('R01', bad, base, 2)
    expect(badGates.filter((g) => !g.pass).map((g) => g.id)).toEqual(['PF-01', 'PF-02a'])
  })
})

describe('P9.4 Bericht aus aufgezeichneten Läufen (tests/fixtures/art)', () => {
  const raws = [
    fixture('sc18-R01-engine-1.json'),
    fixture('sc18-R01-engine-2.json'),
    fixture('sc18-R01-off-1.json'),
    fixture('sc18-R01-off-2.json'),
  ]

  it('P9.4 perf.json enthält alle Größen je Route für „mit“ und „ohne“ Engine', () => {
    const report = buildPerfReport('20261003-iter09-abcdef0', raws, { R01: 2 })
    expect(report.runsPerMode.R01).toEqual({ engine: 2, off: 2 })
    const r = report.routes.R01!
    for (const mode of [r.engine, r.off])
      expect(Object.keys(mode).sort()).toEqual(
        [
          'addEventMs',
          'cls',
          'clsSources',
          'lcp',
          'leashBuild',
          'leashBuildMax',
          'leashFrameP95',
          'loafEngine',
          'loafEngineBy',
          'loafOver50',
          'longtasks',
          'menuEventMs',
          'rafOver33',
          'rafP50',
          'rafP95',
        ].sort(),
      )
    expect(r.engine.rafP50).toBeGreaterThan(0)
    expect(r.off.rafP50).toBeGreaterThan(0)
    expect(r.engine.lcp).toBeGreaterThan(0)
    // Mit Engine misst die Laufzeit `leash:frame`; ohne Engine gibt es keine Messung.
    expect(r.engine.leashFrameP95).not.toBeNull()
    expect(r.off.leashFrameP95).toBeNull()
    expect(report.gates.map((g) => g.id)).toEqual([
      'PF-01',
      'PF-02a',
      'PF-02b',
      'PF-03',
      'PF-04',
      'PF-05',
      'PF-06',
      'PF-07',
      'PF-08',
    ])
    expect(r.layoutEventsWhileScrolling).toBe(2)
  })
})
