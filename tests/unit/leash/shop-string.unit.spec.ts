import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { buildGeometry, mapReadingY, stringRows } from '@/leash/geometry'
import { PRESET_CONFIG } from '@/leash/presets'
import { fnv1a32 } from '@/leash/random'
import type { BuildInput, LeashAnchor, PresetId } from '@/leash/types'

// Raster-Seiten (U-07a) mit laufender Coco (U-44, P13.5): Shop, Kategorie, Archiv, Produkt, Tattoo und Auftragsarbeiten
// teilen die Spur der Startseite – Rinne 56 / 88 am Seitenrand, scrollgekoppelt, Coco an der Leine. Rasterzellen
// (`data-leash-anchor="tag"`, ganze Karten) ergeben je Kartenzeile einen Kringel in der Lücke zur nächsten Zeile; die
// Leine wickelt nie eine Karte ein. Umrundungen (`contour`) nur um kompakte Bildgruppen mit Platz daneben.

const GUTTER = 56
const RAIL = GUTTER / 2
const CARD_LEFT = GUTTER // Kartenraster beginnt rechts der Rinne
const COLS = [CARD_LEFT, 225]
const CARD_W = 153
const CARD_H = 330
const ROWS = [420, 790, 1160]

function cells(rows = ROWS): LeashAnchor[] {
  const out: LeashAnchor[] = []
  rows.forEach((y, r) =>
    COLS.forEach((x, c) =>
      out.push({ id: `tag-${r}-${c}`, kind: 'tag', x, y, w: CARD_W, h: CARD_H, loop: 'none' }),
    ),
  )
  return out
}

function input(preset: PresetId, anchors: LeashAnchor[], h = 1900): BuildInput {
  return {
    preset,
    seed: fnv1a32(`${preset}:R02`),
    root: { w: 390, h },
    viewport: { w: 390, h: 844 },
    gutter: GUTTER,
    railX: RAIL,
    baseWidth: 2.2,
    anchors: [{ id: 'start', kind: 'start', x: RAIL, y: 0, w: 0, h: 0, loop: 'none' }, ...anchors],
  }
}

function points(i: BuildInput) {
  const g = buildGeometry(i)
  const out: { len: number; x: number; y: number }[] = []
  for (let k = 0; k < g.lut.length / 4; k++)
    out.push({ len: g.lut[k * 4]!, x: g.lut[k * 4 + 1]!, y: g.lut[k * 4 + 2]! })
  return { g, pts: out }
}

describe('Shop/Tattoo – Coco läuft mit (U-44)', () => {
  it('Presets: wie die Startseite – scrollgekoppelt mit Intro, Rinne 56 / 88, Coco an der Leine', () => {
    for (const p of ['shopString', 'product', 'stencil', 'frame'] as const) {
      const c = PRESET_CONFIG[p]
      expect(c.draw, p).toBe('scroll')
      expect(c.intro, p).toBe(true)
      expect(c.rail, p).toBe('center')
      expect(c.gutter, p).toEqual(PRESET_CONFIG.journey.gutter)
      expect(c.coco, p).toEqual({ size: 'leash' })
      expect(c.loops, p).toEqual(expect.arrayContaining(['right', 'left', 'contour']))
    }
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
    expect(hash(input('shopString', cells()))).toBe(hash(input('shopString', cells())))
  })

  it('Rasterzellen werden zu Zeilen gruppiert (Oberkante, Unterkante)', () => {
    const rows = stringRows(cells())
    expect(rows).toEqual(ROWS.map((y) => ({ y, bottom: y + CARD_H })))
  })

  it('LG-01: die Linie berührt nie eine Karte – alles in der Rinne links der Kartenkante', () => {
    for (const preset of ['shopString', 'stencil'] as const) {
      const { pts } = points(input(preset, cells()))
      for (const p of pts) {
        expect(p.x).toBeGreaterThanOrEqual(0)
        expect(p.x, `${preset} y=${p.y.toFixed(0)}`).toBeLessThan(CARD_LEFT - 2)
      }
    }
  })

  it('kringelt sich je Kartenzeile in der Lücke zur nächsten Zeile und läuft bis zum Seitenende', () => {
    const { g, pts } = points(input('shopString', cells()))
    const back = pts.filter((p, i) => i > 0 && p.y < pts[i - 1]!.y - 0.05)
    expect(back.length).toBeGreaterThan(8)
    expect(g.stations.map((s) => s.id)).toEqual(['row-0', 'row-1', 'row-2'])
    for (let k = 0; k < ROWS.length - 1; k++) {
      const s = g.stations[k]!
      expect(s.y).toBeGreaterThan(ROWS[k]! + CARD_H - 40)
      expect(s.y).toBeLessThan(ROWS[k + 1]!)
    }
    expect(pts[pts.length - 1]!.y).toBeGreaterThan(1850)
  })

  it('dichte Kringel: Scroll-Weg je Kringel höchstens der halbe Abstand zur nächsten Station', () => {
    const { g } = points(input('shopString', cells()))
    for (let k = 1; k < g.scrollMap.length; k++) {
      expect(g.scrollMap[k]!.readingY).toBeGreaterThan(g.scrollMap[k - 1]!.readingY)
      expect(g.scrollMap[k]!.len).toBeGreaterThan(g.scrollMap[k - 1]!.len)
    }
    const s0 = g.stations[0]!
    const s1 = g.stations[1]!
    const end0 = g.scrollMap.find((p) => Math.abs(p.len - s0.loopLen1) < 0.5)!
    expect(end0.readingY - s0.y).toBeLessThanOrEqual((s1.y - s0.y) / 2 + 1)
    expect(mapReadingY(g.scrollMap, 1e9)).toBe(g.totalLength)
  })

  it('Umrundung um eine kompakte Bildgruppe mit Platz rechts; Ausgang links außen hinab', () => {
    const group: LeashAnchor = {
      id: 'gallery',
      kind: 'station',
      x: CARD_LEFT,
      y: 400,
      w: 280,
      h: 160,
      loop: 'contour',
    }
    const { g, pts } = points(input('stencil', [group]))
    expect(g.stations.find((s) => s.id === 'gallery')).toMatchObject({ loop: 'contour' })
    // läuft rechts an der Gruppe vorbei (10 px Abstand) …
    expect(Math.max(...pts.map((p) => p.x))).toBeGreaterThan(CARD_LEFT + 280 + 4)
    // … und nie durch sie hindurch
    const inside = pts.filter(
      (p) => p.x > group.x + 2 && p.x < group.x + group.w - 2 && p.y > 402 && p.y < 558,
    )
    expect(inside).toEqual([])
    // unterhalb der Gruppe (Folgetext ab x = 56) wieder in der Rinne
    for (const p of pts) if (p.y > 600) expect(p.x).toBeLessThan(CARD_LEFT - 2)
  })

  it('ohne Platz (zu breit oder zu hoch) wird aus der Umrundung ein Kringel in der Rinne', () => {
    for (const box of [
      { w: 330, h: 160 },
      { w: 200, h: 420 },
    ]) {
      const { g, pts } = points(
        input('stencil', [
          { id: 'g', kind: 'station', x: CARD_LEFT, y: 400, ...box, loop: 'contour' },
        ]),
      )
      expect(g.stations[0]).toMatchObject({ loop: 'right' })
      for (const p of pts) expect(p.x).toBeLessThan(CARD_LEFT - 2)
    }
  })
})

describe('U-68 Kategorie-Bilder im Shop: Coco läuft ruhig herum (P15.1)', () => {
  const desk = (y: number, w = 900, h = 180, readingY0 = 0.72 * 900 - 64): BuildInput => ({
    preset: 'shopString',
    seed: fnv1a32('shopString:R02'),
    root: { w: 1264, h: 3000 },
    viewport: { w: 1440, h: 900 },
    gutter: 88,
    railX: 44,
    baseWidth: 2.6,
    readingY0,
    anchors: [
      { id: 'start', kind: 'start', x: 44, y: 0, w: 0, h: 0, loop: 'none' },
      { id: 'kategorien', kind: 'station', x: 100, y, w, h, loop: 'contour' },
    ],
  })

  it('beim Laden schon begonnene Umrundung: Ende der Schlaufe liegt auf der Lesezeile (das Intro zeichnet nur bis zum Anfang, den Rest läuft Coco allein)', () => {
    const i = desk(260)
    const g = buildGeometry(i)
    const s = g.stations.find((x) => x.id === 'kategorien')!
    expect(s).toMatchObject({ loop: 'contour' })
    expect(s.loopLen1 - s.loopLen0).toBeGreaterThan(2000)
    expect(mapReadingY(g.scrollMap, i.readingY0!)).toBeGreaterThanOrEqual(s.loopLen1 - 0.5)
    expect(mapReadingY(g.scrollMap, s.y - 1)).toBeLessThanOrEqual(s.loopLen0 + 0.5)
  })

  it('lange Umrundung erst unterhalb der Lesezeile (am Scrollen): wird zum Kringel – kurze bleibt', () => {
    expect(buildGeometry(desk(1200)).stations[0]).toMatchObject({ loop: 'right' })
    expect(buildGeometry(desk(1200, 260, 325)).stations[0]).toMatchObject({ loop: 'contour' })
  })

  it('ohne gemessene Lesezeile wie bisher: 0,72 × Bildschirmhöhe', () => {
    const { readingY0: _, ...i } = desk(560)
    // 560 < 0,72 × 900 = 648: gilt als beim Laden begonnen
    const g = buildGeometry(i as BuildInput)
    const s = g.stations[0]!
    expect(mapReadingY(g.scrollMap, 0.72 * 900)).toBeGreaterThanOrEqual(s.loopLen1 - 0.5)
  })
})
