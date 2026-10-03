import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { SPACE } from '../../../content/art/space'
import { SPACE_DIR, SPACE_MAX_BYTES, spaceSvg } from '../../../scripts/art/build-space'

// P9.12 Weltraum-Motive (DESIGN §12.5, KUNST-QA AR-03/AR-06): sieben Motive, je ≤ 1,5 KB, Tusche über currentColor,
// höchstens eine Wash-Fläche, keine Formen-Primitive, kein Text (keine Band-Bezüge), deterministisch.

const EXPECTED = ['moon', 'morse-claire', 'orbit', 'planet-ring', 'saucer', 'star-4', 'star-5']
const files = readdirSync(SPACE_DIR).filter((f) => f.endsWith('.svg'))

describe('P9.12 Weltraum-Motive', () => {
  it('alle Motive aus DESIGN §12.5 vorhanden (Planet mit Ring, 4-/5-zackiger Stern, Mond, Umlaufbahn, Untertasse, Morse)', () => {
    expect(files.map((f) => f.replace(/\.svg$/, '')).sort()).toEqual(EXPECTED)
    expect(Object.keys(SPACE).sort()).toEqual(EXPECTED)
  })

  it('AR-03: je ≤ 1,5 KB; Datei entspricht der Quelle (pnpm art:space, byte-gleich)', () => {
    expect(SPACE_MAX_BYTES).toBe(1500)
    for (const [id, m] of Object.entries(SPACE)) {
      const svg = readFileSync(path.join(SPACE_DIR, `${id}.svg`), 'utf8')
      expect(Buffer.byteLength(svg), id).toBeLessThanOrEqual(1500)
      expect(spaceSvg(id, m), id).toBe(svg)
    }
  })

  it('Stil: Tusche über currentColor, höchstens eine Wash-Fläche, keine Primitive, kein Text, aria-hidden', () => {
    for (const f of files) {
      const svg = readFileSync(path.join(SPACE_DIR, f), 'utf8')
      expect(svg, f).toContain('stroke="currentColor"')
      expect(svg, f).toContain('aria-hidden="true"')
      expect(svg, f).not.toMatch(/<(circle|ellipse|rect|polygon|text|image|script|style)\b|href=/i)
      expect((svg.match(/var\(--wash-/g) ?? []).length, f).toBeLessThanOrEqual(1)
      expect(svg.replace(/var\(--[a-z0-9-]+,#[0-9a-f]{3,6}\)/gi, ''), f).not.toMatch(
        /#[0-9a-f]{3,6}\b/i,
      )
    }
  })

  it('Morse-Leiste „CLAIRE“: 5 Striche und 11 Punkte (−·−· ·−·· ·− ·· ·−· ·)', () => {
    const m = SPACE['morse-claire']!
    expect(m.ink.strokes.length).toBe(5)
    expect(m.ink.dots?.length).toBe(11)
  })
})
