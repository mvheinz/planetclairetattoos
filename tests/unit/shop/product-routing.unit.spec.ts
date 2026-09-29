import { describe, expect, it } from 'vitest'

import { getRoute, matchRoute, samplePath } from '@/lib/routes/paths'
import { parseProductSegment, productParams, productPath, productSegment } from '@/lib/shop/format'
import { SHORT_LINK_HEADERS, parseShortLinkNumber, shortLinkLocale } from '@/lib/shop/shortLink'

// P3.7 Produktseite R04 und Kurzlink R31 (KONZEPT §2.3, §2.4): reine Regeln der Auflösung. Die HTTP-Antworten prüft
// `tests/e2e/shop/product-routing.e2e.spec.ts`.

const product = { itemNumber: 17, slug: { de: '017-schale-mit-hund', en: '017-bowl-with-dog' } }

describe('AK-2-03 Auflösung nur über die führenden Ziffern', () => {
  it('Nummer aus „017-slug“, „17“, „0017-alter-slug“, „17abc“; sonst null', () => {
    expect(parseProductSegment('017-schale-mit-hund')).toBe(17)
    expect(parseProductSegment('17')).toBe(17)
    expect(parseProductSegment('0017-alter-slug')).toBe(17)
    expect(parseProductSegment('17abc')).toBe(17)
    expect(parseProductSegment('1234-vase')).toBe(1234)
    for (const bad of ['', 'schale-17', '-17', '0', '000-x', '1234567-x', '100000'])
      expect(parseProductSegment(bad), bad).toBeNull()
  })

  it('kanonisches Segment: 3-stellige Nummer + Slug der Sprache (Rückfall DE, sonst „stueck“)', () => {
    expect(productSegment(product, 'de')).toBe('017-schale-mit-hund')
    expect(productSegment(product, 'en')).toBe('017-bowl-with-dog')
    expect(productSegment({ itemNumber: 17, slug: { de: '017-schale' } }, 'en')).toBe('017-schale')
    expect(productSegment({ itemNumber: 5, slug: null }, 'de')).toBe('005-stueck')
    expect(productSegment({ itemNumber: 1234, slug: '1234-vase' }, 'de')).toBe('1234-vase')
    expect(productPath(product, 'en')).toBe('/en/shop/017-bowl-with-dog')
    expect(productParams(product, 'de')).toEqual({ nummer: '017', slug: 'schale-mit-hund' })
  })

  it('nicht kanonische Formen weichen vom Segment ab (→ 308), die kanonische nicht', () => {
    const canonical = productSegment(product, 'de')
    for (const other of ['17', '0017-schale-mit-hund', '017-alter-slug', '017-bowl-with-dog'])
      expect(other === canonical, other).toBe(false)
    // alle Formen landen auf derselben Nummer
    for (const other of ['17', '0017-schale-mit-hund', '017-alter-slug', '017-bowl-with-dog'])
      expect(parseProductSegment(other)).toBe(17)
  })

  it('Registry: R04 und R31 gebaut; Beispielpfad R04 = kanonische Form von S01', () => {
    expect(getRoute('R04').status).toBe('live')
    expect(getRoute('R31').status).toBe('live')
    expect(samplePath('R04', 'de')).toBe('/de/shop/901-schale-langohr-wuschel')
    expect(samplePath('R04', 'en')).toBe('/en/shop/901-bowl-long-ears-fluff')
    expect(matchRoute('/shop/901-schale-langohr-wuschel', 'de')?.route.id).toBe('R04')
  })
})

describe('AK-2-06 Kurzlink /nr/[nummer]', () => {
  it('nur Ziffern (1–6 Stellen), führende Nullen erlaubt', () => {
    expect(parseShortLinkNumber('17')).toBe(17)
    expect(parseShortLinkNumber('017')).toBe(17)
    expect(parseShortLinkNumber(' 17 ')).toBe(17)
    for (const bad of [null, undefined, '', '17-x', 'abc', '0', '1234567', '1e3'])
      expect(parseShortLinkNumber(bad), String(bad)).toBeNull()
  })

  it('Sprache aus Accept-Language mit q-Werten, Standard de', () => {
    expect(shortLinkLocale('de')).toBe('de')
    expect(shortLinkLocale('en-US,en;q=0.9')).toBe('en')
    expect(shortLinkLocale('fr-FR,en;q=0.5,de;q=0.8')).toBe('de')
    expect(shortLinkLocale('fr-FR')).toBe('de')
    expect(shortLinkLocale(null)).toBe('de')
  })

  it('Antwort-Kopfzeilen: Vary Accept-Language, no-store', () => {
    expect(SHORT_LINK_HEADERS).toEqual({ vary: 'Accept-Language', 'cache-control': 'no-store' })
  })
})
