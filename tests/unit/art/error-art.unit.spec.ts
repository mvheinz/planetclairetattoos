import { describe, expect, it } from 'vitest'

import {
  CARABINER_RING_PATH,
  CARABINER_VIEWBOX,
  HARNESS_STRAP_PATH,
  KNOT_PATH,
  KNOT_VIEWBOX,
  smoothPoints,
} from '@/art/errorArt'
import { inkStrokePath, resample } from '@/art/inkStroke'
import { swingKeyframes } from '@/behaviors/lost'

// P2.19 Zeichnungen der Fehlerseiten (DESIGN KO-18) und Pendel des Moduls `lost` (MI-11).

const coords = (d: string) =>
  [...d.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map((m) => ({
    x: Number(m[1]),
    y: Number(m[2]),
  }))

describe('KO-18 Tuschestrich und Fehler-Zeichnungen', () => {
  it('resample: gleichmäßige Abstände, Start und Ende bleiben', () => {
    const pts = resample(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      2,
    )
    expect(pts[0]).toEqual({ x: 0, y: 0 })
    expect(pts.at(-1)).toEqual({ x: 10, y: 0 })
    expect(pts).toHaveLength(6)
  })

  it('inkStrokePath: geschlossener Umriss, deterministisch, Breite schwankt (Hand statt Zirkel)', () => {
    const line = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
    ]
    const a = inkStrokePath(line, { width: 3, seed: 7 })
    expect(a).toBe(inkStrokePath(line, { width: 3, seed: 7 }))
    expect(a).not.toBe(inkStrokePath(line, { width: 3, seed: 8 }))
    expect(a.startsWith('M')).toBe(true)
    expect(a.endsWith('Z')).toBe(true)
    // obere Kante (erste Hälfte der Punkte): Abstand zur Mittellinie ist nicht überall gleich
    const top = coords(a).slice(10, 90)
    const spread = Math.max(...top.map((p) => p.y)) - Math.min(...top.map((p) => p.y))
    expect(spread).toBeGreaterThan(0.15)
  })

  it('Knäuel und Leinenende liegen in ihrer viewBox', () => {
    for (const [d, box] of [
      [KNOT_PATH, KNOT_VIEWBOX],
      [CARABINER_RING_PATH, CARABINER_VIEWBOX],
      [HARNESS_STRAP_PATH, CARABINER_VIEWBOX],
    ] as const) {
      const pts = coords(d)
      expect(pts.length).toBeGreaterThan(20)
      for (const p of pts) {
        expect(p.x).toBeGreaterThanOrEqual(0)
        expect(p.y).toBeGreaterThanOrEqual(0)
        expect(p.x).toBeLessThanOrEqual(box.w)
        expect(p.y).toBeLessThanOrEqual(box.h)
      }
    }
  })

  it('smoothPoints läuft durch alle Stützpunkte', () => {
    const ctrl = [
      { x: 0, y: 0 },
      { x: 10, y: 5 },
      { x: 20, y: 0 },
    ]
    const out = smoothPoints(ctrl, 4)
    expect(out[0]).toEqual(ctrl[0])
    expect(out[4]).toEqual(ctrl[1])
    expect(out.at(-1)).toEqual(ctrl[2])
  })
})

describe('MI-11 Pendel der losen Leine', () => {
  it('rotate 0 → +2° → −2° → 0 mit --ease-swing', () => {
    const frames = swingKeyframes(2, 'cubic-bezier(0.45, 0, 0.55, 1)')
    expect(frames.map((f) => f.transform)).toEqual([
      'rotate(0deg)',
      'rotate(2deg)',
      'rotate(-2deg)',
      'rotate(0deg)',
    ])
    expect(frames[1]!.offset).toBe(0.25)
    expect(frames[2]!.offset).toBe(0.75)
  })
})
