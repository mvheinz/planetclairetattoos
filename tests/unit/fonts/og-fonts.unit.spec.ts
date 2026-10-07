import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import * as fontkit from 'fontkit'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { checkFonts } from '../../../scripts/check-bundle'
import {
  DISPLAY_REQUIRED_GLYPHS,
  OG_FONT_DIR,
  OG_METRICS_MODULE,
  OG_REQUIRED_GLYPHS,
  buildOgFonts,
  ogMetricsModule,
  type BuiltOgFont,
} from '../../../scripts/fonts/copy'

// P3.14 OG-Schriften (DESIGN §12.6, ARCHITEKTUR §1.2): `pnpm fonts:copy` wandelt offline die statischen WOFF2 von
// Spectral 500 Italic und Bricolage Grotesque 600 per `wawoff2` in TTF um – ohne Netz, byte-gleich bei jedem Lauf, keine
// variable Schrift (satori), Pflicht-Glyphen vorhanden; die Dateien gehen nie an den Browser.

const nodeModules = path.resolve('node_modules')
let first: BuiltOgFont[]
let second: BuiltOgFont[]
const fetchSpy = vi.spyOn(globalThis, 'fetch')

beforeAll(async () => {
  first = await buildOgFonts(nodeModules)
  second = await buildOgFonts(nodeModules)
}, 60_000)

afterAll(() => fetchSpy.mockRestore())

const tablesOf = (data: Buffer) =>
  Object.keys(
    (fontkit.create(data) as unknown as { directory: { tables: Record<string, unknown> } })
      .directory.tables,
  )

describe('P3.14 OG-Schriften', () => {
  it('ohne Netzwerk-Anfrage; zwei Läufe ergeben byte-gleiche TTF-Dateien', () => {
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(second.map((f) => f.file)).toEqual(first.map((f) => f.file))
    for (const [i, font] of first.entries())
      expect(Buffer.compare(font.data, second[i]!.data), font.file).toBe(0)
  })

  it('src/og/fonts enthält nur .ttf – genau die Skript-Ausgabe (Spectral 500 Italic, Bricolage 600)', () => {
    const files = readdirSync(path.resolve(OG_FONT_DIR)).sort()
    expect(files).toEqual(['bricolage-grotesque-600.ttf', 'spectral-500-italic.ttf'])
    for (const font of first) {
      const checkedIn = readFileSync(path.resolve(OG_FONT_DIR, font.file))
      expect(Buffer.compare(checkedIn, font.data), font.file).toBe(0)
    }
    expect(readFileSync(path.resolve(OG_METRICS_MODULE), 'utf8')).toBe(ogMetricsModule(first))
  })

  it('Dateityp TrueType, keine variable Schrift (keine fvar-Tabelle), richtiger Schnitt', () => {
    for (const font of first) {
      expect(font.data.readUInt32BE(0), font.file).toBe(0x00010000)
      expect(tablesOf(font.data), font.file).not.toContain('fvar')
      expect(tablesOf(font.data), font.file).toContain('glyf')
    }
    const bricolage = fontkit.create(
      first.find((f) => f.key === 'bricolage600')!.data,
    ) as fontkit.Font
    expect(
      (bricolage as unknown as { 'OS/2': { usWeightClass: number } })['OS/2'].usWeightClass,
    ).toBe(600)
    expect(bricolage.variationAxes).toEqual({})
    const spectral = fontkit.create(
      first.find((f) => f.key === 'spectral500i')!.data,
    ) as fontkit.Font
    expect(spectral.familyName).toMatch(/^Spectral/)
  })

  it('Glyphen-Abdeckung: Umlaute, ß, €, „“ und die Spectral-Pflichtliste', () => {
    for (const font of first) {
      const parsed = fontkit.create(font.data) as fontkit.Font
      const missing = [...`${OG_REQUIRED_GLYPHS}${DISPLAY_REQUIRED_GLYPHS}`].filter(
        (c) => !parsed.hasGlyphForCodePoint(c.codePointAt(0)!),
      )
      expect(missing, font.file).toEqual([])
    }
  })

  it('keine TTF unter public/; check:bundle meldet TTF/OTF in ausgelieferten Dateien', () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(path.join(dir, e.name)) : [e.name],
      )
    expect(walk(path.resolve('public')).filter((f) => /\.(ttf|otf)$/i.test(f))).toEqual([])

    const dir = mkdtempSync(path.join(tmpdir(), 'pc-ogfonts-'))
    try {
      mkdirSync(path.join(dir, 'media'))
      for (const f of ['a.woff2', 'b.woff2', 'c.woff2', 'd.woff2'])
        writeFileSync(path.join(dir, 'media', f), Buffer.alloc(10))
      expect(checkFonts(dir).errors).toEqual([])
      writeFileSync(path.join(dir, 'media', 'spectral-500-italic.ttf'), first[0]!.data)
      expect(checkFonts(dir).errors.some((e) => e.includes('spectral-500-italic.ttf'))).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
