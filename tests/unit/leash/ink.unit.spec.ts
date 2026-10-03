import { describe, expect, it } from 'vitest'

import { buildGeometry, buildGeometryWithSamples, geometrySteps } from '@/leash/geometry'
import type { BuildInput } from '@/leash/types'

import { lq02, lq03, lq04, lq05, type LineCase } from '../../../scripts/art/lib/checks/line'
import { aboutInput, journeyInput } from './fixtures'

// P9.11 Lebendige Tuschelinie, Stufe A (DESIGN §9.3 Schritte 6–9, §9.4, §9.5; KUNST-QA LQ-02…LQ-05, PF-04/PF-05).

const CASES: [string, BuildInput][] = [
  ['journey 390', journeyInput()],
  ['journey 1440', journeyInput({ w: 1440, h: 900 })],
  ['journey 768', journeyInput({ w: 768, h: 1024 })],
  ['about 390', aboutInput()],
  ['about 1440', aboutInput({ w: 1440, h: 900 })],
]

function lineCases(): LineCase[] {
  return CASES.map(([label, input]) => {
    const { geometry, samples } = buildGeometryWithSamples(input)
    return {
      label,
      samples,
      baseWidth: input.baseWidth,
      loops: geometry.stations.map((s) => ({ id: s.id, len0: s.loopLen0, len1: s.loopLen1 })),
    }
  })
}

describe('leash/ink – Breite, Zittern, Schlaufen (LQ-02…LQ-05)', () => {
  const cases = lineCases()

  it('LQ-02 Breitenband: Mittel 0,95–1,10 × Grundbreite, Variationskoeffizient 0,08–0,20', () => {
    expect(lq02(cases).status).toBe('PASS')
  })

  it('LQ-02 Breiten mit Krümmungszuschlag bleiben in [0,8; 1,35] × Grundbreite (außer Verjüngung)', () => {
    for (const [, input] of CASES) {
      const { samples } = buildGeometryWithSamples(input)
      const total = samples.s[samples.s.length - 1]!
      for (let i = 0; i < samples.s.length; i++) {
        const s = samples.s[i]!
        if (s < 28 || s > total - 18) continue
        expect(samples.w[i]! / input.baseWidth).toBeGreaterThanOrEqual(0.8 - 1e-9)
        expect(samples.w[i]! / input.baseWidth).toBeLessThanOrEqual(1.35 + 1e-9)
      }
    }
  })

  it('LQ-03 Zittern: RMS 0,35–1,3 px, keine gerade Strecke ≥ 120 px', () => {
    const r = lq03(cases)
    expect(r.details ?? []).toEqual([])
    expect(r.status).toBe('PASS')
  })

  it('LQ-04 Schlaufen nie perfekt: Ellipsen-Residuum ≥ 0,6 px, Radiusschwankung ≥ 6 %', () => {
    const r = lq04(cases)
    expect(r.details ?? []).toEqual([])
    expect(r.status).toBe('PASS')
  })

  it('LQ-05 Verjüngung: Federansatz ≤ 0,45 × und Abheben ≤ 0,5 × Grundbreite in den ersten/letzten 4 px', () => {
    expect(lq05(cases).status).toBe('PASS')
    for (const [, input] of CASES) {
      const { samples } = buildGeometryWithSamples(input)
      const n = samples.s.length
      // Ansatz 0,35, dann steigend bis zur vollen Breite nach 28 px; Abheben auf 0,45
      expect(samples.w[0]! / input.baseWidth).toBeCloseTo(0.35, 2)
      expect(samples.w[n - 1]! / input.baseWidth).toBeCloseTo(0.45, 2)
      const at = (len: number) => samples.w[Math.round(len / 2)]! / input.baseWidth
      expect(at(4)).toBeCloseTo(0.35, 2)
      expect(at(10)).toBeGreaterThan(at(4))
      expect(at(28)).toBeGreaterThan(0.75)
    }
  })
})

describe('leash/ink – Stufe A als Strich-Stücke (DESIGN §9.4)', () => {
  it('Tintenpunkte: genau einer je Schlaufenstart nach der Anfangsverjüngung', () => {
    for (const [, input] of CASES) {
      const g = buildGeometry(input)
      const dots = g.segments.flatMap((s) => s.strokes!.filter((st) => st.len1 === st.len0))
      const loops = g.stations.filter((s) => s.loopLen0 > 28)
      expect(dots.length).toBe(loops.length)
      for (const st of loops)
        expect(dots.some((d) => Math.abs(d.len0 - st.loopLen0) <= 2)).toBe(true)
    }
  })

  it('Nahtüberlappung: Nachbar-Segmente überlappen 2 px, Strich-Stücke schließen lückenlos an', () => {
    for (const [, input] of CASES) {
      const g = buildGeometry(input)
      for (let k = 1; k < g.segments.length; k++) {
        const overlap = g.segments[k - 1]!.len1 - g.segments[k]!.len0
        expect(overlap).toBeGreaterThanOrEqual(2 - 1e-6)
        expect(overlap).toBeLessThanOrEqual(4)
      }
      for (const seg of g.segments) {
        const lines = seg.strokes!.filter((st) => st.len1 > st.len0)
        expect(lines[0]!.len0).toBe(seg.len0)
        expect(lines[lines.length - 1]!.len1).toBe(seg.len1)
        for (let i = 1; i < lines.length; i++) expect(lines[i]!.len0).toBe(lines[i - 1]!.len1)
      }
    }
  })

  it('Stücke haben nahezu gleiche Breite und runde Länge; Pfaddaten bleiben im DOM-Budget (≤ 60 KB)', () => {
    for (const [, input] of CASES) {
      const g = buildGeometry(input)
      let bytes = 0
      for (const seg of g.segments)
        for (const st of seg.strokes!) {
          bytes += st.d.length
          expect(st.w).toBeGreaterThan(0.3 * input.baseWidth)
          expect(st.w).toBeLessThanOrEqual(1.35 * 1.3 * input.baseWidth + 0.01)
          expect(st.L).toBeGreaterThan(0)
          if (st.len1 > st.len0) expect(st.L).toBeLessThanOrEqual(1.1 * (st.len1 - st.len0) + 1)
        }
      expect(bytes).toBeLessThan(60_000)
    }
  })

  it('geometrySteps hält mehrfach an und liefert dasselbe Ergebnis wie buildGeometry (deterministisch)', () => {
    const input = journeyInput()
    const steps = geometrySteps(input)
    let pauses = 0
    let r = steps.next()
    while (!r.done) {
      pauses++
      r = steps.next()
    }
    const direct = buildGeometry(input)
    expect(pauses).toBeGreaterThanOrEqual(3 + direct.segments.length)
    expect(r.value.geometry.segments.map((s) => s.outlineD)).toEqual(
      direct.segments.map((s) => s.outlineD),
    )
    expect(r.value.geometry.segments.map((s) => s.strokes)).toEqual(
      direct.segments.map((s) => s.strokes),
    )
  })
})
