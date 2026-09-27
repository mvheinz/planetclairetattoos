import { describe, expect, it } from 'vitest'

import {
  buildProductSlug,
  formatItemNumber,
  isValidItemNumber,
  padItemNumber,
  PRODUCT_SLUG_RE,
  slugify,
  suggestItemNumber,
} from '@/lib/products/itemNumber'

// P1.17: Objektnummer, Anzeigeformat und Slug (E-12, R-041, DATENMODELL §6.6.4, §6.6.8).

describe('R-041 Objektnummer: Format', () => {
  it('R-041 formatItemNumber: „Nr. 017“ / „No. 017“, ab 1000 ohne Auffüllen', () => {
    expect(formatItemNumber(17, 'de')).toBe('Nr. 017')
    expect(formatItemNumber(17, 'en')).toBe('No. 017')
    expect(formatItemNumber(1234, 'en')).toBe('No. 1234')
    expect(formatItemNumber(1, 'de')).toBe('Nr. 001')
    expect(padItemNumber(99999)).toBe('99999')
  })

  it('R-041 gültig sind ganze Zahlen 1–99 999', () => {
    expect(isValidItemNumber(1)).toBe(true)
    expect(isValidItemNumber(99_999)).toBe(true)
    for (const bad of [0, -1, 100_000, 1.5, '17', null, undefined, Number.NaN]) {
      expect(isValidItemNumber(bad), String(bad)).toBe(false)
    }
  })
})

describe('R-041 Slug', () => {
  it('slugify', () => {
    expect(slugify('Schale „Fuchs“ Nr. 1')).toBe('schale-fuchs-nr-1')
    expect(slugify('Große Tüte für Öl')).toBe('grosse-tuete-fuer-oel')
    expect(slugify('Café crème')).toBe('cafe-creme')
    expect(slugify('  --  ')).toBe('')
    expect(slugify('a'.repeat(200)).length).toBeLessThanOrEqual(80)
  })

  it('Slug für Nr. 17 beginnt mit „017-“ und passt zum Muster', () => {
    const slug = buildProductSlug(17, 'Schale mit Hund')
    expect(slug).toBe('017-schale-mit-hund')
    expect(slug).toMatch(PRODUCT_SLUG_RE)
    expect(buildProductSlug(1234, 'Bowl')).toBe('1234-bowl')
    expect(buildProductSlug(5, '„“')).toBe('005-stueck')
    expect(buildProductSlug(5, null)).toMatch(PRODUCT_SLUG_RE)
  })
})

describe('R-041 Nummernvorschlag (§6.6.4)', () => {
  it('echte Stücke 1, 2, 17 und Seed 901 → 18', () => {
    expect(
      suggestItemNumber({ maxReal: 17, taken: new Set([1, 2, 17, 901]), exampleDataPresent: true }),
    ).toBe(18)
  })

  it('ohne Stücke → 1; belegte Nummer wird übersprungen', () => {
    expect(suggestItemNumber({ maxReal: null, taken: new Set(), exampleDataPresent: false })).toBe(
      1,
    )
    expect(
      suggestItemNumber({ maxReal: 17, taken: new Set([17, 18, 19]), exampleDataPresent: false }),
    ).toBe(20)
  })

  it('901–999 gesperrt, solange Beispieldaten existieren', () => {
    expect(suggestItemNumber({ maxReal: 900, taken: new Set(), exampleDataPresent: true })).toBe(
      1000,
    )
    expect(suggestItemNumber({ maxReal: 900, taken: new Set(), exampleDataPresent: false })).toBe(
      901,
    )
    expect(
      suggestItemNumber({ maxReal: 99_999, taken: new Set(), exampleDataPresent: false }),
    ).toBeNull()
  })
})
