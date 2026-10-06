import { describe, expect, it } from 'vitest'

import { hasGlyph, keepCovered, textWidth } from '@/og/metrics'
import { PRODUCT_TITLE, productTitleLines } from '@/og/templates'
import { ellipsize, wrapLines } from '@/og/text'

// P3.14 Titel im OG-Produktbild (DESIGN §12.6): höchstens 3 Zeilen, jede Zeile passt in die Spalte, sonst „…“; Zeichen
// ohne Glyphe fallen weg (kein Nachladen von Schriften/Emoji aus dem Netz).

const mono = (t: string) => [...t].length * 10 // jedes Zeichen 10 px

describe('wrapLines', () => {
  it('bricht an Leerzeichen um und hält die Breite ein', () => {
    expect(wrapLines('aaa bbb ccc ddd', { maxWidth: 70, maxLines: 3, measure: mono })).toEqual([
      'aaa bbb',
      'ccc ddd',
    ])
    expect(wrapLines('  kurz  ', { maxWidth: 70, maxLines: 3, measure: mono })).toEqual(['kurz'])
    expect(wrapLines('', { maxWidth: 70, maxLines: 3, measure: mono })).toEqual([])
  })

  it('kürzt auf 3 Zeilen; die letzte endet an einer Wortgrenze mit „…“', () => {
    const lines = wrapLines('eins zwei drei vier fünf sechs sieben acht neun zehn', {
      maxWidth: 110,
      maxLines: 3,
      measure: mono,
    })
    expect(lines).toHaveLength(3)
    expect(lines[2]!.endsWith('…')).toBe(true)
    for (const l of lines) expect(mono(l)).toBeLessThanOrEqual(110)
    expect(lines[2]).toBe('fünf sechs…')
  })

  it('trennt überlange Wörter hart', () => {
    const lines = wrapLines('Donaudampfschifffahrt', { maxWidth: 80, maxLines: 3, measure: mono })
    expect(lines).toEqual(['Donaudam', 'pfschiff', 'fahrt'])
    const cut = wrapLines('x'.repeat(100), { maxWidth: 50, maxLines: 3, measure: mono })
    expect(cut).toHaveLength(3)
    expect(cut[2]).toBe('xxxx…')
  })

  it('ellipsize entfernt Satzzeichen vor „…“', () => {
    expect(ellipsize('Schale, bemalt.', 200, mono)).toBe('Schale, bemalt…')
    expect(ellipsize('Schale mit Hund', 100, mono)).toBe('Schale…')
  })
})

describe('Titel des OG-Produktbilds (Bricolage 600, 52 px, Spalte 572 px)', () => {
  const measure = (t: string) => textWidth(t, 'bricolage600', PRODUCT_TITLE.fontSize)

  it('kurzer Titel: eine Zeile', () => {
    expect(productTitleLines('Fliese „Auftritt“')).toEqual(['Fliese „Auftritt“'])
  })

  it('langer Titel: höchstens 3 Zeilen, jede passt, letzte mit „…“', () => {
    const lines = productTitleLines(
      'Große bemalte Schale „Langohr & Wuschel“ mit einem sehr langen Titel über drei Zeilen hinaus und noch mehr Text',
    )
    expect(lines).toHaveLength(3)
    expect(lines[2]!.endsWith('…')).toBe(true)
    for (const l of lines) expect(measure(l)).toBeLessThanOrEqual(PRODUCT_TITLE.maxWidth)
  })

  it('Zeichen ohne Glyphe (Emoji, fremde Schriften) fallen weg', () => {
    expect(hasGlyph('bricolage600', 'ä'.codePointAt(0)!)).toBe(true)
    expect(hasGlyph('bricolage600', '🚀'.codePointAt(0)!)).toBe(false)
    expect(keepCovered('Rakete 🚀  zum   Mond ✦ 月', 'bricolage600')).toBe('Rakete zum Mond')
    expect(productTitleLines('🚀🚀🚀')).toEqual([])
    for (const c of 'äöüÄÖÜß€„“') {
      expect(hasGlyph('bricolage600', c.codePointAt(0)!), c).toBe(true)
      expect(hasGlyph('spectral500i', c.codePointAt(0)!), c).toBe(true)
    }
  })
})
