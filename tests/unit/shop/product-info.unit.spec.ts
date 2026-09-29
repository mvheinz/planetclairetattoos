import { describe, expect, it } from 'vitest'

import { MANDATORY_WARNING_TEXTS } from '@/lib/products/warnings'
import {
  DETAIL_KEYS,
  paragraphs,
  pickBusinessInfo,
  productDetailRows,
  safetyWarningTexts,
  shippingRatesDe,
} from '@/lib/shop/productInfo'

// P3.9: reine Bausteine der Produktseiten-Blöcke 7–10 (KONZEPT §3.4, DESIGN KO-09b, R-040, R-031).

describe('paragraphs', () => {
  it('trennt an Leerzeilen, einfache Umbrüche bleiben im Absatz', () => {
    expect(paragraphs('Eins\nzwei\n\n  Drei  \n\n\n')).toEqual(['Eins zwei', 'Drei'])
    expect(paragraphs(null)).toEqual([])
    expect(paragraphs('   ')).toEqual([])
  })
})

describe('KO-09b Details-Tabelle', () => {
  it('Reihenfolge Maße, Gewicht, Material, Technik, Größe, Zustand, Pflege (KONZEPT §3.4 Nr. 8)', () => {
    const rows = productDetailRows(
      {
        category: 'textil',
        dimensions: { note: 'Brustweite 56 cm' },
        weightGrams: 200,
        materials: 'T-Shirt, bemalt',
        sizeLabel: 'L',
        condition: 'good',
        conditionNote: 'leichte Knötchen',
        careInstructions: 'Links gewendet bei 30 °C waschen.',
      },
      'de',
    )
    expect(rows.map((r) => r.key)).toEqual([
      'dimensions',
      'weight',
      'material',
      'size',
      'condition',
      'care',
    ])
    expect(rows.find((r) => r.key === 'weight')?.value).toBe('200\u00a0g')
    expect(rows.find((r) => r.key === 'condition')?.value).toBe('gut – leichte Knötchen')
    expect(rows.find((r) => r.key === 'dimensions')?.field).toBe('dimensionsNote')
    expect(DETAIL_KEYS).toEqual([
      'dimensions',
      'weight',
      'material',
      'technique',
      'size',
      'condition',
      'care',
    ])
  })

  it('leere Felder erzeugen keine Zeile; Gewicht DE/EN (S01: 210 g, DA-9)', () => {
    const rows = productDetailRows(
      {
        category: 'keramik',
        dimensions: { diameterCm: 11, heightCm: 5 },
        weightGrams: 210,
        materials: '  ',
        sizeLabel: null,
        careInstructions: '',
      },
      'en',
    )
    expect(rows.map((r) => r.key)).toEqual(['dimensions', 'weight'])
    expect(rows[1]!.value).toBe('210\u00a0g')
    expect(productDetailRows({ category: 'keramik', weightGrams: 2400 }, 'en')[0]!.value).toBe(
      '2.4\u00a0kg',
    )
    expect(productDetailRows({ category: 'sonstiges' }, 'de')).toEqual([])
  })

  it('Zeichnung: `materials` als „Technik“', () => {
    const rows = productDetailRows({ category: 'zeichnung', materials: 'Tusche auf Papier' }, 'de')
    expect(rows).toEqual([{ key: 'technique', value: 'Tusche auf Papier', field: 'materials' }])
  })
})

describe('R-040 Stammdaten und Warnhinweise', () => {
  it('pickBusinessInfo liest die Whitelist, Land als Name der Sprache', () => {
    const settings = {
      business: {
        legalName: 'Jutta Beispiel',
        tradeName: 'Planet Claire',
        street: 'Musterstraße 1',
        postalCode: '10999',
        city: 'Berlin',
        country: 'DE',
        email: 'hallo@example.org',
      },
    }
    expect(pickBusinessInfo(settings, 'de')).toEqual({
      legalName: 'Jutta Beispiel',
      tradeName: 'Planet Claire',
      street: 'Musterstraße 1',
      postalCode: '10999',
      city: 'Berlin',
      country: 'Deutschland',
      email: 'hallo@example.org',
    })
    expect(pickBusinessInfo(settings, 'en').country).toBe('Germany')
    expect(pickBusinessInfo({}, 'de').legalName).toBeNull()
  })

  it('Deutsch immer, auf /en zusätzlich Englisch; Kleinteile-Hinweis wird ergänzt', () => {
    const input = {
      category: 'schmuck',
      smallPartsWarning: true,
      de: 'Keramik kann brechen.',
      translated: 'Ceramic can break.',
    }
    const en = safetyWarningTexts(input, 'en')
    expect(en.de).toEqual([
      'Keramik kann brechen.',
      MANDATORY_WARNING_TEXTS['product.jewelrySmallParts'].de,
    ])
    expect(en.en).toEqual([
      'Ceramic can break.',
      MANDATORY_WARNING_TEXTS['product.jewelrySmallParts'].en,
    ])
    expect(safetyWarningTexts(input, 'de').en).toEqual([])
    // Ohne eigene EN-Fassung nur Deutsch (kein doppelter Text).
    expect(safetyWarningTexts({ ...input, translated: null }, 'en').en).toEqual([])
  })

  it('Zusatz-Baustein nur einmal; leeres Deutsch → Rückfall-Baustein', () => {
    const extra = { de: 'Dekorationsobjekt.', en: 'Decorative object.' }
    const out = safetyWarningTexts(
      { category: 'keramik', de: 'Zerbrechlich.\n\nDekorationsobjekt.' },
      'de',
      extra,
    )
    expect(out.de).toEqual(['Zerbrechlich.', 'Dekorationsobjekt.'])
    expect(
      safetyWarningTexts({ category: 'sonstiges', de: '' }, 'de', {}, { de: 'Keine.' }).de,
    ).toEqual(['Keine.'])
  })
})

describe('R-031 Versandpreise', () => {
  it('nur Zone DE, nur ganzzahlige Cent', () => {
    expect(
      shippingRatesDe({
        shipping: {
          rates: [
            { zone: 'DE', shippingClass: 'keramik', priceCents: 890 },
            { zone: 'DE', shippingClass: 'brief', priceCents: 450 },
            { zone: 'EU', shippingClass: 'paket_klein', priceCents: 1500 },
            { zone: 'DE', shippingClass: 'paket_klein', priceCents: 6.5 },
          ],
        },
      }),
    ).toEqual({ keramik: 890, brief: 450 })
    expect(shippingRatesDe({})).toEqual({})
  })
})
