import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import {
  LUT_STEP,
  SAMPLE_CHUNK,
  buildGeometry,
  buildGeometryWithSamples,
  geometrySteps,
  mapReadingY,
  pointAt,
} from '@/leash/geometry'
import {
  PRESET_CONFIG,
  READING_LINE,
  isScrollCoupled,
  loopScroll,
  viewTransitionAllowed,
} from '@/leash/presets'
import { PRESET_DOCS } from '@/leash/presetDocs'
import type { BuildInput, PresetId } from '@/leash/types'
import { PRESETS, ROUTES } from '@/lib/routes/registry'

import { journeyInput } from './fixtures'

// P2.15 Tuschelinie-Kern (DESIGN §9.3, §9.6, §9.7, §9.13 AK-DS-12).

const hash = (input: BuildInput) =>
  createHash('sha256')
    .update(
      buildGeometry(input)
        .segments.map((s) => s.outlineD + '|' + s.centerD)
        .join('\n'),
    )
    .digest('hex')

const viewports = [
  { w: 390, h: 844 },
  { w: 768, h: 1024 },
  { w: 1440, h: 900 },
]

describe('leash/geometry – AK-DS-12', () => {
  it('AK-DS-12: buildGeometry ist deterministisch (gleicher Hash von outlineD/centerD)', () => {
    for (const vp of viewports) {
      expect(hash(journeyInput(vp))).toBe(hash(journeyInput(vp)))
    }
    const other = { ...journeyInput(), seed: journeyInput().seed + 1 }
    expect(hash(other)).not.toBe(hash(journeyInput()))
  })

  it('AK-DS-12: scrollMap ist in beiden Spalten streng monoton und endet bei totalLength', () => {
    for (const vp of viewports) {
      const g = buildGeometry(journeyInput(vp))
      expect(g.scrollMap.length).toBeGreaterThan(2)
      for (let k = 1; k < g.scrollMap.length; k++) {
        expect(g.scrollMap[k]!.readingY).toBeGreaterThan(g.scrollMap[k - 1]!.readingY)
        expect(g.scrollMap[k]!.len).toBeGreaterThan(g.scrollMap[k - 1]!.len)
      }
      expect(g.scrollMap[0]).toEqual({ readingY: 0, len: 0 })
      expect(g.scrollMap.at(-1)!.len).toBe(g.totalLength)
    }
  })

  it('AK-DS-12: lut ist nach len sortiert mit Abstand 4 ± 0,01', () => {
    for (const vp of viewports) {
      const g = buildGeometry(journeyInput(vp))
      const count = g.lut.length / 4
      expect(count).toBe(Math.floor(g.totalLength / LUT_STEP) + 1)
      expect(g.lut[0]).toBe(0)
      for (let k = 1; k < count; k++) {
        expect(Math.abs(g.lut[k * 4]! - g.lut[(k - 1) * 4]! - 4)).toBeLessThanOrEqual(0.01)
      }
    }
  })

  it('AK-DS-12: jede Station hat loopLen0 < loopLen1 und liegt im Pfad', () => {
    for (const vp of viewports) {
      const input = journeyInput(vp)
      const g = buildGeometry(input)
      expect(g.stations.map((s) => s.id)).toEqual(
        input.anchors.filter((a) => a.kind === 'station').map((a) => a.id),
      )
      let prev = 0
      for (const s of g.stations) {
        expect(s.loopLen0).toBeLessThan(s.loopLen1)
        expect(s.loopLen0).toBeGreaterThanOrEqual(prev)
        expect(s.loopLen1).toBeLessThanOrEqual(g.totalLength)
        prev = s.loopLen1
      }
    }
  })

  it('AK-DS-12: Breiten liegen in [0,8; 1,35] × baseWidth (außer Anfangs-/Endverjüngung)', () => {
    for (const vp of viewports) {
      const input = journeyInput(vp)
      const { geometry, samples } = buildGeometryWithSamples(input)
      const bw = input.baseWidth
      let min = Infinity
      let max = -Infinity
      expect(Math.min(...samples.w)).toBeGreaterThan(0)
      expect(Math.max(...samples.w)).toBeLessThanOrEqual(1.35 * bw + 1e-9)
      for (let i = 0; i < samples.s.length; i++) {
        const s = samples.s[i]!
        if (s < 28 || s > geometry.totalLength - 18) continue
        min = Math.min(min, samples.w[i]!)
        max = Math.max(max, samples.w[i]!)
      }
      expect(min).toBeGreaterThanOrEqual(0.8 * bw - 1e-9)
      expect(max).toBeLessThanOrEqual(1.35 * bw + 1e-9)
      // Druckvariation sichtbar (nicht konstant)
      expect(max - min).toBeGreaterThan(0.2 * bw)
      // Verjüngung: Anfang 0.35, Ende ≈ 0.45 der Körperbreite
      expect(samples.w[0]!).toBeLessThan(0.45 * bw)
      expect(samples.w.at(-1)!).toBeLessThan(0.65 * bw)
    }
  })

  it('Segmente: Schnitt spätestens alle max(600, 1.25 × Viewport-Höhe), 2 px Überlappung, Pfade im Budget', () => {
    for (const vp of viewports) {
      const g = buildGeometry(journeyInput(vp))
      const maxLen = Math.max(600, 1.25 * vp.h)
      expect(g.segments[0]!.len0).toBe(0)
      expect(g.segments.at(-1)!.len1).toBe(g.totalLength)
      for (let k = 0; k < g.segments.length; k++) {
        const s = g.segments[k]!
        expect(s.len1 - s.len0).toBeLessThanOrEqual(maxLen + 4)
        expect(s.outlineD).toMatch(/^M[\d.-]+ [\d.-]+l[\d. -]+z/)
        expect(s.centerD).toMatch(/^M[\d.-]+ [\d.-]+l[\d. -]+$/)
        expect(s.outlineD).not.toMatch(/\d\.\d\d/) // höchstens 1 Nachkommastelle
        expect(s.bbox.w).toBeGreaterThan(0)
        expect(s.bbox.h).toBeGreaterThan(0)
        if (k > 0) {
          const overlap = g.segments[k - 1]!.len1 - s.len0
          expect(overlap).toBeGreaterThanOrEqual(1.99)
          expect(overlap).toBeLessThanOrEqual(4.01)
        }
      }
      const bytes = g.segments.reduce((sum, s) => sum + s.outlineD.length + s.centerD.length, 0)
      expect(bytes).toBeLessThan(60_000) // DESIGN §9.10: Pfaddaten im DOM ≤ 60 KB je Seite
    }
  })

  it('Leinen-Anschluss (§9.8): Linie beginnt am Start-Anker und endet am unteren Rand in der Rinne', () => {
    const input = journeyInput()
    const g = buildGeometry(input)
    const start = pointAt(g.lut, 0)
    expect(start.x).toBeCloseTo(input.anchors[0]!.x, 0)
    expect(start.y).toBeCloseTo(0, 0)
    const end = pointAt(g.lut, g.totalLength)
    expect(end.y).toBeGreaterThan(input.root.h - 6)
    expect(Math.abs(end.x - input.gutter / 2)).toBeLessThan(input.gutter / 2)
  })

  it('mapReadingY bildet stückweise linear ab (Lesezeile 0.72, Schlaufen-Scrollweg je Station)', () => {
    const input = journeyInput()
    const g = buildGeometry(input)
    expect(READING_LINE).toBe(0.72)
    expect(mapReadingY(g.scrollMap, -50)).toBe(0)
    expect(mapReadingY(g.scrollMap, 1e9)).toBe(g.totalLength)
    const hallo = g.stations.find((s) => s.id === 'hallo')!
    expect(mapReadingY(g.scrollMap, hallo.y)).toBeCloseTo(hallo.loopLen0, 3)
    expect(mapReadingY(g.scrollMap, hallo.y + loopScroll('right', 390))).toBeCloseTo(
      hallo.loopLen1,
      3,
    )
    let prev = -1
    for (let y = 0; y <= input.root.h; y += 7) {
      const len = mapReadingY(g.scrollMap, y)
      expect(len).toBeGreaterThanOrEqual(prev)
      prev = len
    }
  })

  it('Median-Laufzeit journey-Fixture (nur Bericht, Ziel ≤ 8 ms)', () => {
    const input = journeyInput()
    for (let i = 0; i < 5; i++) buildGeometry(input)
    const times: number[] = []
    for (let i = 0; i < 21; i++) {
      const t0 = performance.now()
      buildGeometry(input)
      times.push(performance.now() - t0)
    }
    times.sort((a, b) => a - b)
    const median = times[10]!
    console.info(`[leash] buildGeometry journey 390×844: Median ${median.toFixed(2)} ms`)
    expect(median).toBeGreaterThan(0)
  })
})

describe('leash/presets', () => {
  it('Preset-Tabelle §9.7 deckt alle 11 Presets ab, gleich der Routen-Registry', () => {
    expect(Object.keys(PRESET_CONFIG).sort()).toEqual([...PRESETS].sort())
    const ids: PresetId[] = [...PRESETS]
    expect(ids).toHaveLength(11)
    expect(Object.keys(PRESET_DOCS).sort()).toEqual([...PRESETS].sort())
  })

  it('Routen je Preset stimmen mit der Registry überein', () => {
    for (const route of ROUTES) {
      if (!route.preset || route.kind !== 'page') continue
      expect(PRESET_DOCS[route.preset].routes, route.id).toContain(route.id)
    }
  })

  it('Ruhe-Presets zeichnen nie, journey hat Intro, calm ohne View Transition', () => {
    expect(PRESET_CONFIG.calm.draw).toBe('never')
    expect(PRESET_CONFIG.legal.draw).toBe('never')
    expect(viewTransitionAllowed('calm')).toBe(false)
    expect(PRESET_CONFIG.journey.intro).toBe(true)
    expect(isScrollCoupled('journey')).toBe(true)
    expect(isScrollCoupled('margin')).toBe(true)
    expect(isScrollCoupled('lost')).toBe(false)
    expect(PRESET_CONFIG.journey.gutter).toEqual({ mobile: 44, desktop: 64 })
    expect(PRESET_CONFIG.legal.gutter).toEqual({ mobile: 16, desktop: 24 })
  })
})

describe('leash/geometry – Teilschritte (KUNST-QA PF-04)', () => {
  it('geometrySteps hält mehrfach an und liefert dieselbe Geometrie wie buildGeometryWithSamples', () => {
    for (const vp of [
      { w: 390, h: 844 },
      { w: 1280, h: 800 },
    ]) {
      const input = journeyInput(vp)
      const steps = geometrySteps(input)
      let pauses = 0
      let r = steps.next()
      while (!r.done) {
        pauses++
        r = steps.next()
      }
      // Abtastung, Wackel/Normalen, Breite und je Segment ein Halt.
      expect(pauses).toBeGreaterThanOrEqual(3 + r.value.geometry.segments.length)
      // Schleifen über die Proben halten spätestens alle SAMPLE_CHUNK Proben an (kalter JIT am Desktop ≤ 8 ms):
      // Abtasten, Wackel, Normalen, Breite – je ⌈n / SAMPLE_CHUNK⌉ − 1 Halte mindestens.
      const n = r.value.samples.s.length
      expect(pauses).toBeGreaterThanOrEqual(
        4 * (Math.ceil(n / SAMPLE_CHUNK) - 1) + r.value.geometry.segments.length,
      )
      expect(r.value).toEqual(buildGeometryWithSamples(input))
    }
  })
})
