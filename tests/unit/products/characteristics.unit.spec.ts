import { describe, expect, it } from 'vitest'

import type { ProductCategory } from '@/lib/enums'
import { buildCharacteristics, type CharacteristicsInput } from '@/lib/products/characteristics'
import { formatFibers } from '@/lib/products/fibers'
import { pickLocale } from '@/lib/products/localized'

// P1.16: wesentliche Eigenschaften je Kategorie (DATENMODELL §6.6.2, KONZEPT §4.5 Nr. 1).

const SAMPLES: Record<ProductCategory, CharacteristicsInput> = {
  keramik: {
    category: 'keramik',
    dimensions: { diameterCm: 14, heightCm: 6.5 },
    materials: { de: 'Steinzeug, Unterglasurfarbe', en: 'Stoneware, underglaze' },
    foodContact: 'deko',
  },
  textil: {
    category: 'textil',
    sizeLabel: 'M',
    fiberComposition: [
      { component: 'main', fiber: 'polyester', percent: 40 },
      { component: 'main', fiber: 'cotton', percent: 60 },
      { component: 'lining', fiber: 'viscose', percent: 100 },
    ],
    condition: 'very_good',
    hasDeviation: true,
    deviationDescription: { de: 'kleiner Fleck am linken Ärmel' },
  },
  cap: {
    category: 'cap',
    sizeLabel: { de: 'Einheitsgröße, verstellbar', en: 'One size, adjustable' },
    fiberComposition: [{ component: 'main', fiber: 'cotton', percent: 100 }],
    labelMissing: true,
    condition: 'good',
  },
  zeichnung: {
    category: 'zeichnung',
    dimensions: { widthCm: 21, heightCm: 29.7 },
    materials: { de: 'Aquarell auf Papier 300 g', en: 'Watercolour on 300 g paper' },
    framed: true,
    frameHasGlass: true,
  },
  schmuck: {
    category: 'schmuck',
    dimensions: { heightCm: 3 },
    materials: 'Porzellan, Glasur',
    metalPartsMaterial: { de: 'Edelstahl 316L', en: 'stainless steel 316L' },
  },
  sonstiges: {
    category: 'sonstiges',
    dimensions: { widthCm: 10, heightCm: 15, depthCm: 2 },
    materials: 'Holz, Acryl',
  },
}

describe('buildCharacteristics (DATENMODELL §6.6.2)', () => {
  it('liefert je Kategorie die erwartete Zeile (Snapshot DE/EN)', () => {
    const lines = Object.fromEntries(
      Object.entries(SAMPLES).map(([k, p]) => [
        k,
        { de: buildCharacteristics(p, 'de'), en: buildCharacteristics(p, 'en') },
      ]),
    )
    expect(lines).toMatchInlineSnapshot(`
      {
        "cap": {
          "de": "Cap · Größe Einheitsgröße, verstellbar · 100 % Baumwolle (nach bestem Wissen) · Zustand: gut",
          "en": "Cap · Size One size, adjustable · 100 % Baumwolle (cotton) (to the best of our knowledge) · Condition: good",
        },
        "keramik": {
          "de": "Keramik · Ø 14 cm, Höhe 6,5 cm · Steinzeug, Unterglasurfarbe · Deko – nicht für Lebensmittel",
          "en": "Ceramics · Ø 14 cm, height 6.5 cm · Stoneware, underglaze · Decorative – not for food use",
        },
        "schmuck": {
          "de": "Schmuck · Höhe 3 cm · Porzellan, Glasur · Metallteile: Edelstahl 316L",
          "en": "Jewellery · height 3 cm · Porzellan, Glasur · Metal parts: stainless steel 316L",
        },
        "sonstiges": {
          "de": "Sonstiges · 10 × 15 × 2 cm · Holz, Acryl",
          "en": "Other · 10 × 15 × 2 cm · Holz, Acryl",
        },
        "textil": {
          "de": "Textil · Größe M · 60 % Baumwolle, 40 % Polyester; Futter: 100 % Viskose · Zustand: sehr gut · Besonderheit: kleiner Fleck am linken Ärmel",
          "en": "Textile · Size M · 60 % Baumwolle (cotton), 40 % Polyester (polyester); lining: 100 % Viskose (viscose) · Condition: very good · Special feature: kleiner Fleck am linken Ärmel",
        },
        "zeichnung": {
          "de": "Zeichnung · 21 × 29,7 cm · Aquarell auf Papier 300 g · gerahmt, mit Glas",
          "en": "Drawing · 21 × 29.7 cm · Watercolour on 300 g paper · framed, with glass",
        },
      }
    `)
  })

  it('lebensmittelecht statt Deko, gerahmt ohne Glas', () => {
    expect(
      buildCharacteristics({ category: 'keramik', foodContact: 'lebensmittelecht' }, 'de'),
    ).toBe('Keramik · lebensmittelecht')
    expect(
      buildCharacteristics({ category: 'zeichnung', framed: true, frameHasGlass: false }, 'en'),
    ).toBe('Drawing · framed')
  })

  it('Abweichung nur mit hasDeviation und Text', () => {
    const p = { category: 'sonstiges', deviationDescription: 'Glasurfehler am Rand' }
    expect(buildCharacteristics(p, 'de')).toBe('Sonstiges')
    expect(buildCharacteristics({ ...p, hasDeviation: true }, 'de')).toBe(
      'Sonstiges · Besonderheit: Glasurfehler am Rand',
    )
  })

  it('leeres Stück ergibt leere Zeile', () => {
    expect(buildCharacteristics({}, 'de')).toBe('')
  })
})

describe('formatFibers / pickLocale', () => {
  it('„100 % Baumwolle“, EN mit amtlicher DE-Bezeichnung und Übersetzung', () => {
    const rows = [{ component: 'main', fiber: 'cotton', percent: 100 }]
    expect(formatFibers(rows, 'de')).toBe('100 % Baumwolle')
    expect(formatFibers(rows, 'en')).toBe('100 % Baumwolle (cotton)')
    expect(formatFibers([], 'de')).toBe('')
  })

  it('EN fällt auf DE zurück, DE nie auf EN', () => {
    expect(pickLocale({ de: 'Schale' }, 'en')).toBe('Schale')
    expect(pickLocale({ en: 'Bowl' }, 'de')).toBeUndefined()
    expect(pickLocale({ de: 'Schale', en: ' ' }, 'en')).toBe('Schale')
    expect(pickLocale({ de: 'Schale' }, 'en', false)).toBeUndefined()
    expect(pickLocale(' Schale ', 'de')).toBe('Schale')
  })
})
