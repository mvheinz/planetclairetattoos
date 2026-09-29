import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import {
  STRING_OVERHANG,
  buildGeometry,
  mapReadingY,
  pointAt,
  stringRows,
  stringSag,
} from '@/leash/geometry'
import { PRESET_CONFIG } from '@/leash/presets'
import { fnv1a32 } from '@/leash/random'
import type { BuildInput, LeashAnchor } from '@/leash/types'

// P3.5 Preset `shopString` (DESIGN §9.7, KO-07/KO-08): Schnur durch die Faden-Anker je Kartenreihe mit Durchhang,
// Überstand am Reihenende, Serpentine im Seitenrand; Reihen als Stationen für das Zeichnen beim Eintritt.

const GRID = { left: 16, right: 374 }
const ROWS = [420, 860, 1300]
const COLS = [64, 247]

function shopInput(rows = ROWS, cols = COLS): BuildInput {
  const anchors: LeashAnchor[] = [
    { id: 'start', kind: 'start', x: 43, y: 150, w: 0, h: 0, loop: 'none' },
    {
      id: 'shop-grid',
      kind: 'target',
      x: GRID.left,
      y: 200,
      w: GRID.right - GRID.left,
      h: 0,
      loop: 'none',
    },
  ]
  rows.forEach((y, r) =>
    cols.forEach((x, c) =>
      anchors.push({
        id: `tag-${r}-${c}`,
        kind: 'tag',
        x: x - 0.75,
        y,
        w: 1.5,
        h: 10,
        loop: 'none',
      }),
    ),
  )
  return {
    preset: 'shopString',
    seed: fnv1a32('shopString:R02'),
    root: { w: 390, h: 1700 },
    viewport: { w: 390, h: 844 },
    gutter: 0,
    baseWidth: 2.2,
    anchors,
  }
}

/** Alle LUT-Punkte der Linie. */
function points(input: BuildInput) {
  const g = buildGeometry(input)
  const out: { len: number; x: number; y: number }[] = []
  for (let k = 0; k < g.lut.length / 4; k++)
    out.push({ len: g.lut[k * 4]!, x: g.lut[k * 4 + 1]!, y: g.lut[k * 4 + 2]! })
  return { g, pts: out }
}

describe('shopString – Schnur (DESIGN §9.7)', () => {
  it('Preset zeichnet je Reihe beim Eintritt (500 ms), ohne Rinne, Coco m sitzt', () => {
    expect(PRESET_CONFIG.shopString.draw).toBe('rowEnter')
    expect(PRESET_CONFIG.shopString.durationMs).toBe(500)
    expect(PRESET_CONFIG.shopString.coco).toEqual({ size: 'm', poses: ['sitzen'] })
  })

  it('deterministisch (gleiche Eingabe → gleicher Pfad)', () => {
    const hash = (i: BuildInput) =>
      createHash('sha256')
        .update(
          buildGeometry(i)
            .segments.map((s) => s.outlineD)
            .join('|'),
        )
        .digest('hex')
    expect(hash(shopInput())).toBe(hash(shopInput()))
  })

  it('Faden-Anker werden zu Reihen gruppiert (oben → unten, links → rechts)', () => {
    expect(stringRows(shopInput().anchors)).toEqual(ROWS.map((y) => ({ y, xs: COLS })))
  })

  it('die Schnur läuft durch jeden Faden-Anker und beginnt am Start-Anker (Coco)', () => {
    const { pts } = points(shopInput())
    expect(Math.abs(pts[0]!.x - 43)).toBeLessThan(1.5)
    expect(Math.abs(pts[0]!.y - 150)).toBeLessThan(1.5)
    for (const y of ROWS)
      for (const x of COLS) {
        const d = Math.min(...pts.map((p) => Math.hypot(p.x - x, p.y - y)))
        expect(d, `Anker ${x}/${y}`).toBeLessThan(3)
      }
  })

  it('Durchhang zwischen zwei Ankern: clamp(4, 0.03 × Abstand, 14) px', () => {
    expect(stringSag(50)).toBe(4)
    expect(stringSag(200)).toBe(6)
    expect(stringSag(1000)).toBe(14)
    const { pts } = points(shopInput())
    const mid = (COLS[0]! + COLS[1]!) / 2
    const near = pts.filter((p) => Math.abs(p.x - mid) < 3 && Math.abs(p.y - ROWS[0]!) < 20)
    const lowest = Math.max(...near.map((p) => p.y))
    const expected = ROWS[0]! + stringSag(COLS[1]! - COLS[0]!)
    expect(Math.abs(lowest - expected)).toBeLessThan(2.5)
  })

  it('Serpentine: Reihe 1 endet rechts im Rand (12 px Überstand), Reihe 2 läuft nach links, nie außerhalb der Ebene', () => {
    const { pts } = points(shopInput())
    const between = (y0: number, y1: number) => pts.filter((p) => p.y > y0 + 30 && p.y < y1 - 30)
    const right = between(ROWS[0]!, ROWS[1]!)
    const left = between(ROWS[1]!, ROWS[2]!)
    expect(Math.min(...right.map((p) => p.x))).toBeGreaterThan(GRID.right)
    expect(Math.max(...left.map((p) => p.x))).toBeLessThan(GRID.left)
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThanOrEqual(390)
    }
    // Schnurende: Überstand über das Raster hinaus, im Rand der letzten Reihe (3 Reihen → endet rechts)
    const end = pts[pts.length - 1]!
    expect(end.x).toBeGreaterThan(GRID.right + STRING_OVERHANG / 2)
    expect(Math.abs(end.y - ROWS[2]!)).toBeLessThan(3)
  })

  it('Reihen als Stationen row-0…: lückenlos aneinander, Treppen-Abbildung zeichnet je Reihe ganz', () => {
    const { g } = points(shopInput())
    expect(g.stations.map((s) => s.id)).toEqual(['row-0', 'row-1', 'row-2'])
    expect(g.stations[0]!.loopLen0).toBe(0)
    for (let k = 1; k < g.stations.length; k++)
      expect(g.stations[k]!.loopLen0).toBeCloseTo(g.stations[k - 1]!.loopLen1, 6)
    expect(g.stations.at(-1)!.loopLen1).toBeCloseTo(g.totalLength, 0)
    for (let k = 1; k < g.scrollMap.length; k++) {
      expect(g.scrollMap[k]!.readingY).toBeGreaterThan(g.scrollMap[k - 1]!.readingY)
      expect(g.scrollMap[k]!.len).toBeGreaterThan(g.scrollMap[k - 1]!.len)
    }
    // Vor der ersten Reihe fast nichts, direkt danach Reihe 1 vollständig, dann Reihe 2
    expect(mapReadingY(g.scrollMap, ROWS[0]! - 1)).toBeLessThan(1)
    expect(mapReadingY(g.scrollMap, ROWS[0]! + 1)).toBeCloseTo(g.stations[0]!.loopLen1, 0)
    expect(mapReadingY(g.scrollMap, ROWS[1]! + 1)).toBeCloseTo(g.stations[1]!.loopLen1, 0)
    // auch die letzte Reihe springt beim Eintritt auf ihre volle Länge (nicht erst am Seitenende)
    expect(mapReadingY(g.scrollMap, ROWS[2]! + 1)).toBeCloseTo(g.totalLength, 0)
    expect(mapReadingY(g.scrollMap, 1e9)).toBe(g.totalLength)
    // Pfaddaten im Budget (§9.10 ≤ 60 KB je Seite)
    const bytes = g.segments.reduce((n, s) => n + s.outlineD.length + s.centerD.length, 0)
    expect(bytes).toBeLessThan(60_000)
  })

  it('ohne Karten nur der kurze Leinen-Anschluss', () => {
    const input = shopInput([], [])
    const g = buildGeometry(input)
    expect(g.totalLength).toBeLessThan(30)
    expect(g.stations).toEqual([])
    expect(Math.abs(pointAt(g.lut, 0).y - 150)).toBeLessThan(1.5)
  })
})
