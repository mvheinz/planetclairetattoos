import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import {
  BUDGET_GZ,
  EXERCISES,
  FITNESS_JSON,
  FITNESS_STILL,
  STILL_MAX,
  STILL_SIZE,
  buildFitness,
  stillSvg,
  type FitnessData,
} from '../../../scripts/art/fitness-coco'
import { loopMs } from '../../../src/lib/fitness/timeline'

// P12.5 Fitness-Coco (U-09, FITNESS-COCO.md): sieben Übungen in Juttas Reihenfolge + erschöpft Liegen, je Übung 4–6 s,
// weiche Überblendungen, kleiner Ablaufplan (Puppen-Gerüst statt Bildfolge), Quelle = Generator-Ausgabe.

const data = JSON.parse(readFileSync(FITNESS_JSON, 'utf8')) as FitnessData
const budgets = JSON.parse(readFileSync('tests/perf/budgets.json', 'utf8')) as {
  svg: { lazy: { file: string; rawMax: number; gzipMax: number }[] }
}

describe('Fitness-Coco Ablaufplan', () => {
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
    expect(EXERCISES.map((e) => e.id)).toEqual(data.ex.map((e) => e.id))
    expect(data.v).toBe(2)
  })

  it('je Übung 4–6 s, Überblendung ≤ 1,7 s, Schleife ≈ 40–45 s', () => {
    for (const e of data.ex) {
      expect(e.ms, e.id).toBeGreaterThanOrEqual(4000)
      expect(e.ms, e.id).toBeLessThanOrEqual(6000)
      expect(e.w, e.id).toBeGreaterThanOrEqual(600)
      expect(e.w, e.id).toBeLessThanOrEqual(1700)
    }
    expect(loopMs(data)).toBeGreaterThan(38_000)
    expect(loopMs(data)).toBeLessThan(46_000)
  })

  it('Datenbudget: Ablaufplan ≤ 6 KB gz; Standbild (WebP 720 × 900 mit Transparenz) und Budgets laut Budget-Datei', async () => {
    const json = readFileSync(FITNESS_JSON)
    expect(gzipSync(json, { level: 9 }).length).toBeLessThanOrEqual(BUDGET_GZ)
    const meta = await sharp(FITNESS_STILL).metadata()
    expect([meta.width, meta.height, meta.format, meta.hasAlpha]).toEqual([
      ...STILL_SIZE,
      'webp',
      true,
    ])
    expect(readFileSync(FITNESS_STILL).length).toBeLessThanOrEqual(STILL_MAX)
    for (const l of budgets.svg.lazy.filter((x) => /fitness/.test(x.file))) {
      const raw = readFileSync(l.file)
      expect(raw.length, l.file).toBeLessThanOrEqual(l.rawMax)
      expect(gzipSync(raw, { level: 9 }).length, l.file).toBeLessThanOrEqual(l.gzipMax)
    }
  })

  it('Standbild-Quelle (SVG, nicht ausgeliefert): Tusche schwarz, Buntstift orange, keine Beschriftung, kein Bildanteil', () => {
    const svg = stillSvg()
    expect(svg).not.toMatch(/<text|<image|<circle|<rect/)
    expect(svg).toContain('stroke="#1C1A17"')
    expect(svg).toContain('stroke="#D9822B"')
    expect(svg).toBe(buildFitness().still)
  })

  it('Ablaufplan ist die aktuelle Generator-Ausgabe (pnpm art:fitness)', () => {
    const { data: fresh } = buildFitness()
    expect(JSON.parse(JSON.stringify(fresh))).toEqual(data)
  })
})
