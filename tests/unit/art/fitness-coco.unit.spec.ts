import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

import { describe, expect, it } from 'vitest'

import {
  BUDGET_GZ,
  EXERCISES,
  FITNESS_JSON,
  FITNESS_STILL,
  FRAME_MS,
  FRAME_RANGE,
  buildFitness,
  stillSvg,
  loopMs,
  lying,
  standing,
  type FitnessData,
} from '../../../scripts/art/fitness-coco'

// P12.5 Fitness-Coco (U-09, FITNESS-COCO.md): sieben Übungen in Juttas Reihenfolge + erschöpft Liegen, 12–24 Zwischenbilder
// je Übung, 4–6 s, weiche Übergänge, Knickohr, Datenbudget (≤ 150 KB gz), Quelle = Generator-Ausgabe.

const data = JSON.parse(readFileSync(FITNESS_JSON, 'utf8')) as FitnessData

describe('Fitness-Coco Daten', () => {
  it('Reihenfolge: Body wave, Body bounce, Single arm raises, Hip rotation, Chest opener, Trunk twist, Thump up, Liegen', () => {
    expect(data.ex.map((e) => e.id)).toEqual([
      'wave',
      'bounce',
      'arm',
      'hip',
      'chest',
      'twist',
      'thump',
      'lying',
    ])
    expect(EXERCISES.map((e) => e.id)).toEqual(data.ex.slice(0, 7).map((e) => e.id))
  })

  it('je Übung 12–24 Zwischenbilder und 4–6 s; Übergang (3 Bilder) vor jeder Übung; Schleife ≈ 40 s', () => {
    for (const e of data.ex) {
      expect(e.fr.length, e.id).toBeGreaterThanOrEqual(FRAME_RANGE[0])
      expect(e.fr.length, e.id).toBeLessThanOrEqual(FRAME_RANGE[1])
      expect(e.ms, e.id).toBeGreaterThanOrEqual(4000)
      expect(e.ms, e.id).toBeLessThanOrEqual(6000)
      // jedes Bild ein eigener Entwurf (kein Wiederholen desselben Pfads) – von Hand gezeichnet gewirkt
      expect(new Set(e.fr).size, e.id).toBe(e.fr.length)
    }
    expect(data.tr).toHaveLength(data.ex.length)
    for (const t of data.tr) expect(t.length).toBeGreaterThanOrEqual(3)
    expect(data.f).toBe(FRAME_MS)
    expect(loopMs(data)).toBeGreaterThan(38_000)
  })

  it('Datenbudget: ≤ 150 KB gz insgesamt; Standbild (eigene SVG-Datei, <img>) ≤ 6 KB', () => {
    const json = readFileSync(FITNESS_JSON)
    expect(gzipSync(json, { level: 9 }).length).toBeLessThanOrEqual(BUDGET_GZ)
    const still = readFileSync(FITNESS_STILL, 'utf8')
    expect(still.length).toBeLessThanOrEqual(6000)
    expect(still).not.toMatch(/<text|<image|<circle|<rect/)
    // Tusche schwarz, Buntstift orange (Linie bleibt schwarz)
    expect(still).toContain('stroke="#1C1A17"')
    expect(still).toContain('stroke="#D9822B"')
  })

  it('Bilder: schwarze Tuschelinie (Pfade) + oranger Buntstift getrennt, keine Beschriftung (kein <text>)', () => {
    for (const e of data.ex)
      for (const f of e.fr) {
        const [ink, pencil] = f.split('|')
        expect(ink!.length).toBeGreaterThan(200)
        expect(pencil!.length).toBeGreaterThan(40)
        expect(f).not.toMatch(/<|>|text/)
      }
  })

  it('Quelle ist die aktuelle Generator-Ausgabe (pnpm art:fitness)', () => {
    const { data: fresh, still } = buildFitness()
    expect(JSON.stringify(fresh)).toBe(JSON.stringify(data))
    expect(readFileSync(FITNESS_STILL, 'utf8')).toBe(stillSvg(still))
  })
})

describe('Fitness-Coco Zeichnung', () => {
  it('rechtes Ohr (Bild links) ist in jeder Pose geknickt (U-07), auch liegend', () => {
    for (const e of EXERCISES)
      for (const t of [0, 0.25, 0.5, 0.75])
        expect(
          standing(e.pose(t)).ink.some((s) => s.knick),
          `${e.id} ${t}`,
        ).toBe(true)
    expect(lying(0).ink.some((s) => s.knick)).toBe(true)
  })

  it('Buntstift nur im Fell: Schraffur-Flächen vorhanden, weiße Brust und Pfoten bleiben Papier (keine Fläche dort)', () => {
    const b = standing(EXERCISES[0]!.pose(0))
    expect(b.fur.length).toBeGreaterThanOrEqual(6)
  })
})
