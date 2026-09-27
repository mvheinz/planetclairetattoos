import { readFileSync } from 'node:fs'
import path from 'node:path'

import * as fontkit from 'fontkit'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { GlyphFallback } from '@/components/typography/GlyphFallback'
import { formatMoney } from '@/lib/money'
import { MANSALVA_COVERAGE } from '@/styles/mansalvaCoverage.generated'
import { MANSALVA_REQUIRED_GLYPHS, mansalvaHasGlyph, splitGlyphRuns } from '@/styles/glyphs'

// AK-DS-05 (DESIGN §4.1, §4.4): Glyphen-Pflichtliste gegen die ausgelieferte Mansalva-Datei; `GlyphFallback` ist
// genau für fehlende Zeichen aktiv.

const mansalvaFile = path.resolve('src/styles/fonts/mansalva-latin-400-normal.woff2')
const font = fontkit.create(readFileSync(mansalvaFile)) as fontkit.Font
const render = (text: string) => renderToStaticMarkup(createElement(GlyphFallback, null, text))

describe('AK-DS-05 Mansalva-Glyphen', () => {
  it('AK-DS-05 die Pflichtliste ist vollständig in der Mansalva-Datei', () => {
    const missing = [...MANSALVA_REQUIRED_GLYPHS].filter(
      (c) => !font.hasGlyphForCodePoint(c.codePointAt(0)!),
    )
    expect(missing).toEqual([])
  })

  it('AK-DS-05 die erzeugte Abdeckung entspricht der Schriftdatei', () => {
    const fromFile = [...new Set(font.characterSet)].sort((a, b) => a - b)
    const fromTable = MANSALVA_COVERAGE.flatMap(([a, b]) =>
      Array.from({ length: b - a + 1 }, (_, i) => a + i),
    )
    expect(fromTable).toEqual(fromFile)
  })

  it('AK-DS-05 GlyphFallback ist genau für fehlende Zeichen aktiv', () => {
    // Pflichtliste plus Zeichen, die Mansalva nicht hat (schmales geschütztes Leerzeichen, Pfeil, Haken, Emoji).
    const sample = `${MANSALVA_REQUIRED_GLYPHS}   →✓★😊`
    for (const char of sample) {
      const cp = char.codePointAt(0)!
      const expected = !font.hasGlyphForCodePoint(cp)
      expect(mansalvaHasGlyph(cp), `U+${cp.toString(16)}`).toBe(!expected)
      expect(splitGlyphRuns(char)[0]!.fallback, `U+${cp.toString(16)}`).toBe(expected)
    }
    const fallbackText = splitGlyphRuns(sample)
      .filter((r) => r.fallback)
      .map((r) => r.text)
      .join('')
    expect(fallbackText).toBe(' →✓★😊')
  })

  it('AK-DS-05 Snapshot Preisschild „38,50 €“ ohne Ersatzglyphen', () => {
    const price = formatMoney(3850, 'de', { style: 'tag' })
    expect(price).toBe('38,50 €')
    // Snapshot als Zeichenkette mit Escapes (geschütztes Leerzeichen U+00A0 sichtbar): kein Ersatz-<span>.
    expect(render(price)).toBe('38,50\u00a0€')
  })

  it('AK-DS-05 Snapshot mit fehlendem Zeichen: nur dieses in Bricolage 600', () => {
    expect(render('38,50\u202f€ → sold')).toBe(
      '38,50<span class="glyph-fallback">\u202f</span>€ <span class="glyph-fallback">→</span> sold',
    )
  })
})
