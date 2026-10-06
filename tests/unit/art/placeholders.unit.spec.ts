import { readFileSync } from 'node:fs'
import path from 'node:path'

import sharp from 'sharp'
import { beforeAll, describe, expect, it } from 'vitest'

import { ART, STROKE_WIDTH } from '../../../scripts/art/lib/handline'
import {
  buildPlaceholders,
  motifNames,
  OUTPUT_DIR,
  PLACEHOLDER_MAX_BYTES,
  placeholderWashes,
} from '../../../scripts/art/placeholders'

// P8.12/P8.13 Platzhalter-Zeichnungen (DESIGN §12.3, SEED-SPEC §4.2, KUNST-QA AR-03/AR-04): Regeln für jede Datei
// unter `src/art/placeholders/`, Motiv-Skizzen ohne Formen-Primitive, Generator deterministisch.

const washes = placeholderWashes()
const names = [...washes.keys()].sort()
const read = (name: string) => readFileSync(path.join(OUTPUT_DIR, `${name}.svg`), 'utf8')
const WASH_HEX = Object.values(ART.wash)
const COCO = ['shirt-02', 'cap-01', 'zeichnung-01', 'anhaenger-01', 'flash-906', 'tattoo-03']

/** Höhe der Tinten-Bounding-Box (dunkle Pixel) nach Rasterung, als Anteil der Bildhöhe. */
async function inkHeightRatio(svg: string): Promise<number> {
  const { data, info } = await sharp(Buffer.from(svg), { density: 72 })
    .resize(400, 500, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  let top = info.height
  let bottom = -1
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels
      const lum = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!
      if (lum < 80) {
        if (y < top) top = y
        bottom = y
        break
      }
    }
  }
  return bottom < 0 ? 0 : (bottom - top + 1) / info.height
}

describe('P8.12/P8.13 Platzhalter-Zeichnungen', () => {
  it('SEED-SPEC §4.2: zu jedem Platzhalter aus media.json gibt es Motiv-Skizze und SVG (30 Stück)', () => {
    expect(names).toHaveLength(30)
    expect(motifNames()).toEqual(names)
    for (const name of names) expect(() => read(name), name).not.toThrow()
  })

  it('AR-03 AR-04: viewBox 400×500, Strich 2.8 Tusche (P9.13) mit runden Enden, kein Text, keine Formen-Primitive, ≤ 6 KB, ±3°', () => {
    for (const name of names) {
      const svg = read(name)
      expect(svg, name).toContain('viewBox="0 0 400 500"')
      expect(svg, name).toMatch(
        new RegExp(
          `<g fill="none" stroke="${ART.ink}" stroke-width="${STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round">`,
        ),
      )
      expect(svg, name).not.toMatch(
        /<text|<circle|<ellipse|<rect|<polygon|<polyline|<line[\s>]|<image|<use/,
      )
      expect(Buffer.byteLength(svg), name).toBeLessThanOrEqual(PLACEHOLDER_MAX_BYTES)
      const tilt = /<g transform="rotate\((-?[\d.]+) 200 250\)">/.exec(svg)
      expect(tilt, name).not.toBeNull()
      expect(Math.abs(Number(tilt![1])), name).toBeLessThanOrEqual(3)
      expect(Math.abs(Number(tilt![1])), name).toBeGreaterThan(0)
      // Strichstärken-Gruppen (R1-03-02): Grundstärke 2.8 plus dünne/kräftige Gruppe; Tattoo zusätzlich die Teilzeichnung
      const widths = [...svg.matchAll(/stroke-width="([\d.]+)"/g)].map((m) => Number(m[1]))
      expect(widths[0], name).toBe(STROKE_WIDTH)
      for (const w of widths.slice(1))
        expect(w, name).toBeGreaterThanOrEqual(name.startsWith('tattoo-') ? 1 : 2.3)
      if (name.startsWith('tattoo-')) expect(widths.length, name).toBeGreaterThanOrEqual(2)
    }
  })

  it('AR-04 DESIGN §12.3: höchstens eine Wash-Farbe (laut media.json; ohne Wash = Flash und Stufe 1 der Stil-Leiter), Papier-2 als Grund', () => {
    for (const name of names) {
      const svg = read(name)
      const fills = [...svg.matchAll(/fill="(#[0-9A-F]{6})"/gi)].map((m) => m[1]!.toUpperCase())
      expect(fills[0], name).toBe(ART.paper2)
      const used = fills.filter((f) => (WASH_HEX as string[]).includes(f))
      const wash = washes.get(name)
      if (name.startsWith('flash-')) expect(wash, name).toBeNull()
      if (wash === null) {
        expect(used, name).toEqual([])
      } else {
        expect(used, name).toEqual([ART.wash[wash!]])
      }
      // sonst nur Tusche (Pupillen, Nase), Papier (Glanzpunkt) und das rote Geschirr bei Coco
      const others = fills.filter((f) => f !== ART.paper2 && !(WASH_HEX as string[]).includes(f))
      for (const f of others) expect([ART.ink, ART.paper, ART.harness], name).toContain(f)
    }
  })

  it('DESIGN §10.1: Coco-Motive tragen das rote Geschirr', () => {
    for (const name of COCO) expect(read(name), name).toContain(`fill="${ART.harness}"`)
  })

  it('DESIGN §12.3: Motiv 55–70 % der Bildhöhe (Tinten-Bounding-Box nach Rasterung)', async () => {
    for (const name of names) {
      const ratio = await inkHeightRatio(read(name))
      expect(ratio, name).toBeGreaterThanOrEqual(0.55)
      expect(ratio, name).toBeLessThanOrEqual(0.7)
    }
  }, 60_000)

  it('Motiv-Skizzen: gezeichnete Bezier-Pfade, keine Formen-Primitive', () => {
    for (const name of [...names, '_parts']) {
      const src = readFileSync(path.join('content/art/placeholders', `${name}.ts`), 'utf8')
      expect(src, name).not.toMatch(/<circle|<ellipse|<rect|\barc\(|\bellipse\(|\bcircle\(/)
    }
  })

  describe('Generator', () => {
    let first: Map<string, string>
    beforeAll(async () => {
      first = await buildPlaceholders()
    }, 60_000)

    it('deterministisch: zwei Läufe byte-gleich und gleich den eingecheckten Dateien', async () => {
      const second = await buildPlaceholders()
      expect([...second.keys()]).toEqual([...first.keys()])
      for (const [name, svg] of first) {
        expect(second.get(name), name).toBe(svg)
        expect(read(name), `${name}: pnpm art:placeholders ausführen`).toBe(svg)
      }
    }, 60_000)
  })
})
