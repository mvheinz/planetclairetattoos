import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { buildGeometry, mapReadingY, pointAt, stringRows } from '@/leash/geometry'
import { PRESET_COCO_POSES } from '@/leash/presetDocs'
import { PRESET_CONFIG } from '@/leash/presets'
import { fnv1a32 } from '@/leash/random'
import type { BuildInput, LeashAnchor } from '@/leash/types'

// Raster-Seiten (U-07a, ersetzt P3.5): Preset `shopString` (Shop, Kategorie, Archiv) – die Leine läuft ausschließlich in
// der Rinne am Seitenrand, kringelt sich zwischen den Kartenzeilen und wickelt nie eine Karte ein. Reihen sind
// Stationen für das Zeichnen beim Eintritt.

const RAIL = 16
const GUTTER = 32
const CARD_LEFT = GUTTER // Kartenraster beginnt rechts der Rinne
const COLS = [CARD_LEFT, 211]
const CARD_W = 165
const CARD_H = 330
const ROWS = [420, 860, 1300]

function shopInput(rows = ROWS): BuildInput {
  const anchors: LeashAnchor[] = [
    { id: 'start', kind: 'start', x: 70, y: 150, w: 0, h: 0, loop: 'none' },
    {
      id: 'shop-grid',
      kind: 'target',
      x: CARD_LEFT,
      y: 200,
      w: 390 - CARD_LEFT - 16,
      h: 0,
      loop: 'none',
    },
  ]
  rows.forEach((y, r) =>
    COLS.forEach((x, c) =>
      anchors.push({
        id: `tag-${r}-${c}`,
        kind: 'tag',
        x: x + CARD_W / 2 - 0.75,
        y: y + 250,
        w: 1.5,
        h: 10,
        loop: 'none',
      }),
    ),
  )
  return {
    preset: 'shopString',
    seed: fnv1a32('shopString:R02'),
    root: { w: 390, h: 1900 },
    viewport: { w: 390, h: 844 },
    gutter: GUTTER,
    railX: RAIL,
    baseWidth: 2.2,
    anchors,
  }
}

function points(input: BuildInput) {
  const g = buildGeometry(input)
  const out: { len: number; x: number; y: number }[] = []
  for (let k = 0; k < g.lut.length / 4; k++)
    out.push({ len: g.lut[k * 4]!, x: g.lut[k * 4 + 1]!, y: g.lut[k * 4 + 2]! })
  return { g, pts: out }
}

describe('shopString – Leine in der Rinne (U-07a)', () => {
  it('Preset: Zeichnen je Reihe beim Eintritt (U-06: 1000 ms), Rinne am Rand, Coco m sitzt', () => {
    expect(PRESET_CONFIG.shopString.draw).toBe('rowEnter')
    expect(PRESET_CONFIG.shopString.durationMs).toBe(1000)
    expect(PRESET_CONFIG.shopString.rail).toBe('center')
    expect(PRESET_CONFIG.shopString.gutter).toEqual({ mobile: 32, desktop: 56 })
    expect(PRESET_CONFIG.shopString.coco).toEqual({ size: 'm' })
    expect(PRESET_COCO_POSES.shopString).toEqual(['sitzen'])
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
    const rows = stringRows(shopInput().anchors)
    expect(rows.map((r) => r.y)).toEqual(ROWS.map((y) => y + 250))
    expect(rows[0]!.xs).toHaveLength(2)
  })

  it('LG-01: die Linie berührt nie eine Karte – alles links der Kartenkante, nie außerhalb der Ebene', () => {
    const { pts } = points(shopInput())
    // Ausnahme: das Stück zwischen Coco (Start-Anker) und Rinne über der ersten Reihe
    const firstCardTop = ROWS[0]!
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThanOrEqual(390)
      if (p.y >= firstCardTop) expect(p.x, `y=${p.y.toFixed(0)}`).toBeLessThan(CARD_LEFT - 2)
    }
  })

  it('beginnt am Start-Anker (Coco), kommt in die Rinne und kringelt sich je Reihe in einer Schlaufe', () => {
    const { g, pts } = points(shopInput())
    expect(Math.abs(pts[0]!.x - 70)).toBeLessThan(1.5)
    expect(Math.abs(pts[0]!.y - 150)).toBeLessThan(1.5)
    // je Reihe eine Schlaufe: die Linie läuft innerhalb der Rinne einmal rückwärts (y fällt)
    const back = pts.filter((p, i) => i > 0 && p.y < pts[i - 1]!.y - 0.05)
    expect(back.length).toBeGreaterThan(8)
    expect(g.stations.map((s) => s.id)).toEqual(['row-0', 'row-1', 'row-2'])
    // Schlaufen liegen zwischen zwei Faden-Zeilen (Mitte der Lücke, in der Rinne)
    for (let k = 0; k < ROWS.length - 1; k++) {
      const s = g.stations[k]!
      expect(s.y).toBeGreaterThan(ROWS[k]! + 250)
      expect(s.y).toBeLessThan(ROWS[k + 1]! + 250)
    }
  })

  it('Reihen als Stationen: lückenlos aneinander, Treppen-Abbildung zeichnet je Reihe ganz', () => {
    const { g } = points(shopInput())
    for (let k = 1; k < g.scrollMap.length; k++) {
      expect(g.scrollMap[k]!.readingY).toBeGreaterThan(g.scrollMap[k - 1]!.readingY)
      expect(g.scrollMap[k]!.len).toBeGreaterThan(g.scrollMap[k - 1]!.len)
    }
    expect(mapReadingY(g.scrollMap, 1e9)).toBe(g.totalLength)
    const bytes = g.segments.reduce((n, s) => n + s.outlineD.length + s.centerD.length, 0)
    expect(bytes).toBeLessThan(60_000)
  })

  it('ohne Karten nur der kurze Leinen-Anschluss', () => {
    const input = shopInput([])
    const g = buildGeometry(input)
    expect(g.totalLength).toBeLessThan(120)
    expect(g.stations).toEqual([])
    expect(Math.abs(pointAt(g.lut, 0).y - 150)).toBeLessThan(1.5)
  })
})

describe('stencil/Flash – Leine in der Rinne (U-07a, LG-01)', () => {
  const flashInput = (): BuildInput => {
    const anchors: LeashAnchor[] = [
      { id: 'start', kind: 'start', x: RAIL, y: 0, w: 0, h: 0, loop: 'none' },
      {
        id: 'tattoo-title',
        kind: 'station',
        x: 48,
        y: 120,
        w: 200,
        h: 40,
        loop: 'none',
        pose: 'kopfschief',
      },
    ]
    ROWS.forEach((y, r) =>
      COLS.forEach((x, c) =>
        anchors.push({
          id: `f-${r}${c}`,
          kind: 'station',
          x,
          y,
          w: CARD_W,
          h: CARD_H,
          loop: 'contour',
        }),
      ),
    )
    anchors.push({ id: 'end', kind: 'end', x: RAIL, y: 1800, w: 0, h: 0, loop: 'none' })
    return {
      preset: 'stencil',
      seed: fnv1a32('stencil:R12'),
      root: { w: 390, h: 1900 },
      viewport: { w: 390, h: 844 },
      gutter: GUTTER,
      railX: RAIL,
      baseWidth: 2.2,
      anchors,
    }
  }

  it('Preset: Rinne am Seitenrand, keine Kontur-Schlaufe mehr', () => {
    expect(PRESET_CONFIG.stencil.rail).toBe('center')
    expect(PRESET_CONFIG.stencil.loops).not.toContain('contour')
  })

  it('LG-01: Flash-Karten werden nie umschlossen oder überquert', () => {
    const { g, pts } = points(flashInput())
    for (const p of pts) {
      expect(p.x).toBeLessThan(CARD_LEFT - 2)
      expect(p.x).toBeGreaterThanOrEqual(0)
    }
    // eine Schlaufe je Kartenzeile in der Lücke zur nächsten Zeile
    expect(g.stations.filter((s) => s.id.startsWith('f-'))).toHaveLength(ROWS.length)
  })
})
