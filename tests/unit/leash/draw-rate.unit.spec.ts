import { describe, expect, it } from 'vitest'

import { buildGeometry, capDrawRate, mapReadingY } from '@/leash/geometry'
import { MAX_DRAW_RATE, MAX_LOOP_SHIFT, READING_LINE, loopScroll } from '@/leash/presets'
import { fnv1a32 } from '@/leash/random'
import type { BuildInput, LeashAnchor, PresetId } from '@/leash/types'

import { journeyInput } from './fixtures'

// U-55 (P14.6): „Die Animation, die Coco mit der Leine macht, ist an manchen Punkten extrem schnell, wenn sie etwas
// umwickelt.“ Ursache: Umrundungen (`contour`, 1 400–2 700 px Bogen) und eng liegende Kringel bekamen nur 400–480 px bzw.
// 1 px Scroll-Weg – 3- bis 200-mal so viel Linie je px Scroll wie dazwischen. Die Scroll-Abbildung begrenzt das Tempo
// jetzt je Abschnitt möglichst auf `MAX_DRAW_RATE` px Linie je px Scroll; die Schlaufen rücken dafür höchstens
// `MAX_LOOP_SHIFT` × Bildschirmhöhe von ihrer Station weg. Was dann noch zu schnell wäre (sehr lange Umrundung auf kurzem
// Weg), deckelt die Laufzeit: Coco und Tinte höchstens `COCO_MAX_SPEED` px/ms (runtime.unit.spec.ts).

/** Höchsttempo je Abschnitt, das die Scroll-Abbildung auf den Fixtures erreicht (vorher Umrundung 3,2–3,6, dicht > 200). */
const SCROLL_RATE_LIMIT = 2.6

type Map = { readingY: number; len: number }[]

/** Tempo je Abschnitt; Abschnitte, die schon beim Laden über der Lesezeile enden (`from`), zeichnet das Intro. */
const rates = (map: Map, from = 0) =>
  map
    .slice(1)
    .map((p, k) => ({ p, a: map[k]! }))
    .filter(({ p }) => p.readingY > from)
    .map(({ p, a }) => (p.len - a.len) / Math.max(1e-9, p.readingY - a.readingY))

const maxRate = (map: Map, from = 0) => Math.max(...rates(map, from))

/** Lesezeile, bei der die Linie die Länge `len` erreicht (Umkehrung von `mapReadingY`). */
const yAt = (map: Map, len: number) => {
  const k = map.findIndex((p) => p.len >= len)
  const a = map[Math.max(0, k - 1)]!
  const b = map[k]!
  return b.len === a.len
    ? b.readingY
    : a.readingY + ((len - a.len) / (b.len - a.len)) * (b.readingY - a.readingY)
}

const station = (
  id: string,
  y: number,
  loop: LeashAnchor['loop'],
  rect: Partial<LeashAnchor> = {},
): LeashAnchor => ({ id, kind: 'station', x: 60, y, w: 24, h: 24, loop, pose: 'sitzen', ...rect })

/** Startseite wie gemessen (P14.1): Kopf, Keramik (Kringel), Textil (Umrundung der Zeichnung), Spirale, Schmuck, Tattoo (Umrundung). */
function homeInput(viewport: { w: number; h: number }, preset: PresetId = 'journey'): BuildInput {
  const desktop = viewport.w >= 768
  const gutter = desktop ? 88 : 56
  const left = desktop ? Math.max(0, (viewport.w - 1100) / 2) : 0
  const rail = left + gutter / 2
  const art = (y: number): Partial<LeashAnchor> => ({
    x: left + gutter + 16,
    y,
    w: desktop ? 260 : 240,
    h: desktop ? 325 : 300,
  })
  const gap = desktop ? 1200 : 1500
  const top = 220
  return {
    preset,
    seed: fnv1a32(`${preset}:`),
    root: { w: viewport.w, h: top + 5 * gap + 600 },
    viewport,
    gutter,
    baseWidth: desktop ? 2.6 : 2.2,
    anchors: [
      { id: 'start', kind: 'start', x: rail, y: 0, w: 0, h: 0, loop: 'none' },
      station('planet-claire', 40, 'orbit', { x: left + gutter + 10, y: 40, w: 64, h: 64 }),
      station('keramik', top + 0.5 * gap, 'right'),
      station('textil', top + gap, 'contour', art(top + gap)),
      station('zeichnungen', top + 2 * gap, 'spiral'),
      station('schmuck', top + 3 * gap, 'right'),
      station('tattoo', top + 4 * gap, 'contour', art(top + 4 * gap)),
    ],
  }
}

/** Raster wie Shop/Tattoo: zwei Stationen so dicht, dass sich ihre Schlaufen-Scrollwege überlappen (früher 1 px). */
function crowdedInput(viewport: { w: number; h: number }): BuildInput {
  const base = homeInput(viewport, 'shopString')
  const anchors = base.anchors.filter((a) => a.id !== 'keramik')
  const textil = anchors.find((a) => a.id === 'textil')!
  anchors.push(station('dicht', textil.y + 60, 'left'))
  return { ...base, anchors }
}

describe('U-55 Zeichentempo begrenzt (P14.6)', () => {
  it('capDrawRate: zu schneller Abschnitt leiht Weg zuerst danach, Ende/Anfang bleiben, alles monoton', () => {
    const map: Map = [
      { readingY: 0, len: 0 },
      { readingY: 1000, len: 1000 }, // Weg zur Station (1,0)
      { readingY: 1400, len: 2600 }, // Umrundung: 1 600 px auf 400 px Scroll (4,0)
      { readingY: 3000, len: 3800 }, // ruhiger Weg danach (0,75)
      { readingY: 3400, len: 4000 },
    ]
    const out = capDrawRate(map, 1.8)
    expect(maxRate(map)).toBeCloseTo(4, 5)
    expect(maxRate(out)).toBeLessThanOrEqual(1.8 + 1e-9)
    expect(out[0]).toEqual(map[0])
    expect(out.at(-1)).toEqual(map.at(-1))
    expect(out.map((p) => p.len)).toEqual(map.map((p) => p.len))
    for (let k = 1; k < out.length; k++)
      expect(out[k]!.readingY).toBeGreaterThan(out[k - 1]!.readingY)
    // Die Umrundung beginnt weiter dort, wo die Lesezeile die Station erreicht (Weg danach reicht)
    expect(out[1]!.readingY).toBe(1000)
    expect(out[2]!.readingY - out[1]!.readingY).toBeCloseTo(1600 / 1.8, 5)
  })

  it('capDrawRate: reicht der Weg danach nicht, gibt der Weg davor ab; ohne Spielraum bleibt der Rest im Abschnitt', () => {
    const map: Map = [
      { readingY: 0, len: 0 },
      { readingY: 1000, len: 500 }, // viel Spielraum davor
      { readingY: 1100, len: 1500 }, // 10,0
      { readingY: 1200, len: 1600 }, // kaum Spielraum danach
    ]
    const out = capDrawRate(map, 1.8)
    expect(maxRate(out)).toBeLessThanOrEqual(1.8 + 1e-9)
    expect(out[1]!.readingY).toBeLessThan(1000) // Anfang rückt vor
    const tight = capDrawRate(
      [
        { readingY: 0, len: 0 },
        { readingY: 10, len: 500 },
        { readingY: 20, len: 510 },
      ],
      1.8,
    )
    expect(tight.at(-1)!.readingY).toBe(20)
    expect(maxRate(tight)).toBeLessThan(50) // vorher 50, Rest bleibt über dem Grenzwert
  })

  it('capDrawRate: kein Knoten wandert weiter als maxShift (Schlaufen bleiben bei ihrer Station)', () => {
    const map: Map = [
      { readingY: 0, len: 0 },
      { readingY: 400, len: 400 },
      { readingY: 401, len: 561 }, // 161 px Linie auf 1 px Scroll (überlappende Schlaufen)
      { readingY: 1400, len: 1400 },
      { readingY: 1500, len: 1600 },
    ]
    const free = capDrawRate(map, 1.8)
    expect(maxRate(free)).toBeLessThanOrEqual(1.8 + 1e-9)
    const bound = capDrawRate(map, 1.8, 0, 50)
    for (let i = 0; i < map.length; i++)
      expect(Math.abs(bound[i]!.readingY - map[i]!.readingY)).toBeLessThanOrEqual(50 + 1e-9)
    expect(maxRate(bound)).toBeLessThan(maxRate(map) / 10) // Spitze trotzdem viel flacher
    expect(bound.at(-1)).toEqual(map.at(-1))
  })

  for (const vp of [
    { w: 390, h: 844 },
    { w: 768, h: 1024 },
    { w: 1280, h: 800 },
    { w: 1440, h: 900 },
  ]) {
    it(`maximale Zeichengeschwindigkeit je Abschnitt ≤ ${SCROLL_RATE_LIMIT} px/px – Startseite ${vp.w} px`, () => {
      const g = buildGeometry(homeInput(vp))
      expect(maxRate(g.scrollMap, READING_LINE * vp.h)).toBeLessThanOrEqual(SCROLL_RATE_LIMIT)
      for (const s of g.stations)
        expect(Math.abs(yAt(g.scrollMap, s.loopLen0) - s.y), s.id).toBeLessThanOrEqual(
          MAX_LOOP_SHIFT * vp.h + 1e-6,
        )
      // Umrundungen bekommen mehr Scroll-Weg als früher (loopScroll) und beginnen weiter an der Station (± 1/4 Bildschirm)
      for (const s of g.stations.filter((x) => x.id === 'textil' || x.id === 'tattoo')) {
        const len = s.loopLen1 - s.loopLen0
        expect(len / loopScroll('contour', vp.w), `${s.id} vorher`).toBeGreaterThan(MAX_DRAW_RATE)
        const y0 = yAt(g.scrollMap, s.loopLen0)
        const y1 = yAt(g.scrollMap, s.loopLen1)
        expect(Math.abs(y0 - s.y), `${s.id} Anfang`).toBeLessThanOrEqual(
          MAX_LOOP_SHIFT * vp.h + 1e-6,
        )
        expect(y1 - y0, `${s.id} Scroll-Weg`).toBeGreaterThanOrEqual(len / SCROLL_RATE_LIMIT)
      }
      // Kringel davor beginnen weiter an ihrer Station (sie geben höchstens Weg ab, bleiben ≤ Grenzwert)
      const k = g.stations.find((x) => x.id === 'keramik')!
      expect(mapReadingY(g.scrollMap, k.y)).toBeCloseTo(k.loopLen0, 3)
    })

    it(`dicht liegende Schlaufen springen nicht mehr (früher 1 px Scroll-Weg) – Raster ${vp.w} px`, () => {
      const g = buildGeometry(crowdedInput(vp))
      expect(maxRate(g.scrollMap, READING_LINE * vp.h)).toBeLessThanOrEqual(SCROLL_RATE_LIMIT)
      for (let k = 1; k < g.scrollMap.length; k++) {
        expect(g.scrollMap[k]!.readingY).toBeGreaterThan(g.scrollMap[k - 1]!.readingY)
        expect(g.scrollMap[k]!.len).toBeGreaterThan(g.scrollMap[k - 1]!.len)
      }
    })
  }

  it('Seiten ohne Scroll-Kopplung bleiben unverändert (einmalige Zeichnung)', () => {
    const g = buildGeometry({ ...journeyInput(), preset: 'thanks' })
    expect(g.scrollMap).toHaveLength(2)
  })
})
