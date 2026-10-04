import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { STATION_SVGS } from '../../../src/art/stations/stations.generated'
import {
  readSources,
  STATION_MAX_BYTES,
  STATIONS_DIR,
  vectorizeSource,
  type VectorizeSource,
} from '../../../scripts/art/vectorize'

// P8.14 Stationszeichnungen (DESIGN §12.4, §9.10, KUNST-QA AR-01/AR-03, E-73): Größe, Quellen-Whitelist,
// `currentColor`, Determinismus mit einer Mini-Quelle.

const budgets = JSON.parse(readFileSync('tests/perf/budgets.json', 'utf8')) as {
  svg: { stationRawMax: number; homeTotalRawMax: number }
}
const HOME_STATIONS = [
  'hallo',
  'keramik',
  'textil',
  'zeichnungen',
  'schmuck',
  'tattoo',
  'jutta-und-coco',
]
/** Zuordnung DESIGN §12.4 – einzige erlaubte Foto-Vorlagen. */
const ALLOWED_VECTORIZE: Record<string, string> = {
  keramik: 'post-DdUPhoZOoMW.jpg',
  textil: 'post-DcT7ErBDsWi.jpg',
  zeichnungen: 'post-DaJH_kADpsK.jpg',
  tattoo: 'post-DbJ1QRrjCcb.jpg',
}
const DERIVED = ['planet-claire', 'hallo', 'schmuck', 'jutta-und-coco']
const files = readdirSync(STATIONS_DIR).filter((f) => f.endsWith('.svg'))
const read = (id: string) => readFileSync(path.join(STATIONS_DIR, `${id}.svg`), 'utf8')

describe('P8.14 Stationszeichnungen', () => {
  it('AR-03 DESIGN §9.10: jede Station ≤ 8 KB, die 7 Stationen der Startseite zusammen deutlich unter 60 KB', () => {
    expect(STATION_MAX_BYTES).toBe(budgets.svg.stationRawMax)
    for (const f of files)
      expect(readFileSync(path.join(STATIONS_DIR, f)).length, f).toBeLessThanOrEqual(
        STATION_MAX_BYTES,
      )
    const total = HOME_STATIONS.reduce((sum, id) => sum + Buffer.byteLength(read(id)), 0)
    // Rest des Budgets bleibt für Marken, Icons und Linie (gemessen von pnpm check:bundle)
    expect(total).toBeLessThanOrEqual(budgets.svg.homeTotalRawMax * 0.7)
  })

  it('AR-01: Quellen nur aus der Zuordnung DESIGN §12.4 – keine Kundenhaut-Fotos, keine Bilder mit Jutta, keine Highlights', () => {
    const sources = readSources()
    const vec = Object.fromEntries(sources.vectorize.map((s) => [s.id, s.file]))
    expect(vec).toEqual(ALLOWED_VECTORIZE)
    expect(sources.derived.map((d) => d.id).sort()).toEqual([...DERIVED].sort())
    const all = JSON.stringify(sources)
    expect(all).not.toMatch(/highlight-|profil\.jpg|DdHXUQsDjqm/)
    // Kundenhaut-Fotos der Galerie (showsCustomer) tauchen nie als Quelle auf
    const tattoo = JSON.parse(readFileSync('content/seed/data/tattoo.json', 'utf8')) as {
      gallery: { image: string; showsCustomer: boolean }[]
    }
    for (const g of tattoo.gallery.filter((x) => x.showsCustomer)) {
      const code = g.image.replace(/^media:ig:/, '').split('#')[0]!
      expect(all, g.image).not.toContain(code)
    }
    // jede Datei hat eine Quelle, jede Quelle eine Datei
    expect(files.map((f) => f.replace(/\.svg$/, '')).sort()).toEqual(
      [...Object.keys(vec), ...DERIVED].sort(),
    )
  })

  it('E-73: Tusche über currentColor; Farben nur als Kunst-Token mit Rückfall; kein Text, kein Skript, keine Fremd-Referenz', () => {
    for (const f of files) {
      const svg = readFileSync(path.join(STATIONS_DIR, f), 'utf8')
      expect(svg, f).toContain('currentColor')
      expect(svg.replace(/var\(--[a-z0-9-]+,#[0-9a-f]{3,6}\)/gi, ''), f).not.toMatch(
        /#[0-9a-f]{3,6}\b/i,
      )
      expect(svg, f).not.toMatch(/<text|<script|<image|href=|<style/i)
    }
  })

  it('stations.generated.ts entspricht den SVG-Dateien (pnpm art:vectorize)', () => {
    expect(Object.keys(STATION_SVGS).sort()).toEqual(
      files.map((f) => f.replace(/\.svg$/, '')).sort(),
    )
    for (const [id, svg] of Object.entries(STATION_SVGS)) expect(read(id), id).toBe(svg)
  })

  it('potrace (GPL) nur als exakt gepinnte devDependency', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      dependencies: Record<string, string>
      devDependencies: Record<string, string>
    }
    expect(pkg.dependencies.potrace).toBeUndefined()
    expect(pkg.devDependencies.potrace).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('Determinismus: Mini-Quelle zweimal vektorisiert → byte-gleich, gefüllte Umrisse in currentColor', async () => {
    const mini = await sharp(
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="150"><rect width="120" height="150" fill="#f4efe6"/><path d="M20 120C30 40 80 20 100 60M40 30C50 50 60 60 90 130" fill="none" stroke="#111" stroke-width="5"/><circle cx="60" cy="90" r="6" fill="#111"/></svg>',
      ),
    )
      .jpeg()
      .toBuffer()
    const src: VectorizeSource = {
      id: 'mini',
      file: 'mini.jpg',
      crop: { x: 0, y: 0, w: 100, h: 100 },
      channel: 'luma',
      threshold: 'otsu',
      upscale: 3,
      turdSize: 10,
      alphaMax: 1.1,
      optTolerance: 0.4,
    }
    const a = await vectorizeSource(mini, src)
    const b = await vectorizeSource(mini, src)
    expect(a).toBe(b)
    expect(a).toMatch(
      /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 \d+ \d+"><path fill="currentColor"/,
    )
    expect(Buffer.byteLength(a)).toBeLessThanOrEqual(STATION_MAX_BYTES)
  }, 30_000)
})
