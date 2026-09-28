import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import * as fontkit from 'fontkit'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  BRICOLAGE_WGHT,
  buildFonts,
  coverageModule,
  coverageRanges,
  FONT_BUDGET_BYTES,
  type BuiltFont,
} from '../../../scripts/fonts/copy'
import { checkFonts } from '../../../scripts/check-bundle'
import { MANSALVA_REQUIRED_GLYPHS } from '@/styles/glyphs'

// P2.4 `pnpm fonts:copy` (DESIGN §4.1, AK-DS-04): genau 3 WOFF2, ≤ 100 KB, deterministisch, Bricolage auf wght
// 400–700 beschnitten; eingecheckte Dateien entsprechen der Skript-Ausgabe.

const nodeModules = path.resolve('node_modules')
const fontsDir = path.resolve('src/styles/fonts')
let first: BuiltFont[]
let second: BuiltFont[]

beforeAll(async () => {
  first = await buildFonts(nodeModules)
  second = await buildFonts(nodeModules)
}, 60_000)

describe('P2.4 fonts:copy', () => {
  it('zwei Läufe ergeben byte-gleiche Dateien', () => {
    expect(second.map((f) => f.file)).toEqual(first.map((f) => f.file))
    for (const [i, font] of first.entries()) {
      expect(Buffer.compare(font.data, second[i]!.data), font.file).toBe(0)
    }
  })

  it('AK-DS-04 genau 3 WOFF2-Dateien, zusammen ≤ 100 KB', () => {
    expect(first).toHaveLength(3)
    for (const font of first) {
      expect(font.file).toMatch(/\.woff2$/)
      expect(font.data.subarray(0, 4).toString('latin1')).toBe('wOF2')
    }
    const total = first.reduce((sum, f) => sum + f.data.length, 0)
    expect(total).toBeLessThanOrEqual(FONT_BUDGET_BYTES)
  })

  it('eingecheckte Dateien unter src/styles/fonts entsprechen der Skript-Ausgabe', () => {
    for (const font of first) {
      const checkedIn = readFileSync(path.join(fontsDir, font.file))
      expect(Buffer.compare(checkedIn, font.data), font.file).toBe(0)
    }
    const mansalva = first.find((f) => f.file.startsWith('mansalva'))!
    expect(readFileSync(path.resolve('src/styles/mansalvaCoverage.generated.ts'), 'utf8')).toBe(
      coverageModule(coverageRanges(mansalva.data)),
    )
  })

  it('beschnittene Bricolage deckt wght 400–700 und die Glyphen-Pflichtliste ab', () => {
    const bricolage = first.find((f) => f.file.startsWith('bricolage'))!
    const font = fontkit.create(bricolage.data) as fontkit.Font
    const axes = font.variationAxes as Record<string, { min: number; max: number }>
    expect(axes.wght?.min).toBe(BRICOLAGE_WGHT.min)
    expect(axes.wght?.max).toBe(BRICOLAGE_WGHT.max)
    const missing = [...MANSALVA_REQUIRED_GLYPHS].filter(
      (c) => !font.hasGlyphForCodePoint(c.codePointAt(0)!),
    )
    expect(missing).toEqual([])
    // Variationsdaten bleiben erhalten (Achse wirkt weiter, nur im Bereich 400–700).
    const tables = (font as unknown as { directory: { tables: Record<string, unknown> } }).directory
      .tables
    expect(Object.keys(tables)).toEqual(expect.arrayContaining(['fvar', 'gvar']))
  })

  it('Plex Mono nur 400, Mansalva mit Handschrift-Alternativen (calt)', () => {
    const plex = fontkit.create(first.find((f) => f.file.startsWith('ibm'))!.data) as fontkit.Font
    expect(plex.variationAxes).toEqual({})
    const mansalva = fontkit.create(
      first.find((f) => f.file.startsWith('mansalva'))!.data,
    ) as fontkit.Font
    expect(mansalva.availableFeatures).toContain('calt')
  })
})

describe('AK-DS-04 check:bundle Schriftprüfung', () => {
  it('AK-DS-04 meldet falsche Anzahl, Übergröße und Google-Fonts-Verweise', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'pc-fonts-'))
    try {
      mkdirSync(path.join(dir, 'media'))
      for (const f of first) writeFileSync(path.join(dir, 'media', f.file), f.data)
      expect(checkFonts(dir).errors).toEqual([])
      writeFileSync(path.join(dir, 'media', 'extra.woff2'), Buffer.alloc(10))
      writeFileSync(
        path.join(dir, 'x.css'),
        '@import url(https://fonts.googleapis.com/css2?family=X)',
      )
      const errors = checkFonts(dir).errors
      expect(errors.some((e) => e.includes('4 .woff2'))).toBe(true)
      expect(errors.some((e) => e.includes('Google-Fonts'))).toBe(true)
      writeFileSync(path.join(dir, 'media', 'extra.woff2'), Buffer.alloc(FONT_BUDGET_BYTES))
      expect(checkFonts(dir).errors.some((e) => e.includes('Budget'))).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
