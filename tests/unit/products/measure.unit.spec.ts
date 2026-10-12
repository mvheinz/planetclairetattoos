import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  ESTIMATE_MARKERS,
  findEstimateMarker,
  largestDimension,
  measurementIssues,
  SIZE_COMPARE_BANDS,
  SIZE_COMPARE_MAX_CM,
  sizeComparison,
} from '@/lib/products/measure'
import { validateForPublish, type ProductForValidation } from '@/lib/products/validate'

import de from '../../../src/i18n/messages/de.json'
import en from '../../../src/i18n/messages/en.json'

// P20.6 (V-15, U-93): Maße ehrlich – Schätz-Vermerke in Maß-Hinweis und Größe sperren das Online-Stellen („Bitte erst
// nachmessen“), ein schlichtes „ca.“ nicht. Größenvergleich für sehr kleine Stücke (< 4 cm) als fester Satz.

describe('V-15 Schätz-Vermerke (zentrale Liste, DE und EN)', () => {
  it.each([
    ['Breite ca. 40 cm, Länge ca. 55 cm – geschätzt', 'geschätzt'],
    ['Maße geschätzt; handgeformt', 'geschätzt'],
    ['Geschätzte Höhe 7 cm', 'geschätzt'],
    ['Höhe geschaetzt 7 cm', 'geschätzt'],
    ['Höhe 7 cm (Schätzung)', 'Schätzung'],
    ['vermutlich 7 cm hoch', 'vermutlich'],
    ['Höhe bitte nachmessen', 'nachmessen'],
    ['Kordellänge noch messen', 'noch messen'],
    ['Länge nicht gemessen', 'nicht gemessen'],
    ['Kordellänge bitte ergänzen', 'bitte ergänzen'],
    ['Width approx. 40 cm – estimated', 'estimated'],
    ['Estimated measurements; hand-formed', 'estimated'],
    ['presumably 7 cm tall', 'presumably'],
    ['probably 7 cm', 'probably'],
    ['cord length to be added', 'to be measured'],
    ['height to be measured', 'to be measured'],
    ['length not yet measured', 'not measured'],
    ['length TBD', 'tbd'],
  ])('„%s“ → Vermerk „%s“', (text, label) => {
    expect(findEstimateMarker(text)?.label).toBe(label)
  })

  it.each([
    'ca. 40 × 40 cm ohne Henkel',
    'Höhe etwa 7 cm, ungefähr 5 cm breit',
    'approx. 40 cm, about 7 cm, roughly 5 cm',
    'nach meiner Einschätzung sehr stabil',
    'Brustweite 52 cm, Länge 70 cm',
    'Einheitsgröße, verstellbar 54–60 cm',
    '',
  ])('kein Vermerk: „%s“', (text) => {
    expect(findEstimateMarker(text)).toBeNull()
  })

  it('zerlegte Umlaute (NFD) werden erkannt; jede Marke hat Schlüssel und Beschriftung', () => {
    expect(findEstimateMarker('Höhe geschätzt')?.id).toBe('de-geschaetzt')
    expect(new Set(ESTIMATE_MARKERS.map((m) => m.id)).size).toBe(ESTIMATE_MARKERS.length)
    for (const m of ESTIMATE_MARKERS) expect(m.label.length).toBeGreaterThan(2)
  })

  it('Meldung „Bitte erst nachmessen“ nennt Feld und Sprache; Maß-Hinweis und Größe in beiden Sprachen', () => {
    const issues = measurementIssues({
      dimensions: { note: { de: 'ca. 7 cm', en: 'approx. 7 cm – estimated' } },
      sizeLabel: { de: 'M (vermutlich)', en: 'M' },
    })
    expect(issues.map((i) => [i.field, i.locale, i.marker.label])).toEqual([
      ['dimensions.note', 'en', 'estimated'],
      ['sizeLabel', 'de', 'vermutlich'],
    ])
    expect(issues[0]!.message).toMatch(
      /^Bitte erst nachmessen: .*„Hinweis zu den Maßen“ \(Englisch\)/,
    )
    expect(issues[1]!.message).toContain('„Größe“ (Deutsch)')
    // ein String (eine Sprache) gilt als Deutsch
    expect(measurementIssues({ dimensions: { note: 'Maße geschätzt' } })[0]!.locale).toBe('de')
    expect(measurementIssues({ dimensions: null, sizeLabel: null })).toEqual([])
  })

  it('validateForPublish sperrt mit „Bitte erst nachmessen“, „ca.“ bei gemessenen Werten bleibt erlaubt', () => {
    const base: ProductForValidation = {
      itemNumber: 17,
      category: 'keramik',
      title: { de: 'Schale' },
      description: { de: 'Handbemalte Schale.' },
      priceCents: 4500,
      materials: { de: 'Steinzeug' },
      dimensions: { diameterCm: 8, heightCm: 5, note: { de: 'ca. 8 cm, leicht unrund' } },
      weightGrams: 300,
      shippingClass: 'keramik',
      safetyWarnings: { de: 'Zerbrechlich.' },
      ownDesignConfirmed: true,
      images: [1],
      foodContact: 'deko',
    }
    const ctx = {
      allowVisibleBlankBrands: false,
      business: {
        legalName: 'J',
        street: 'S 1',
        postalCode: '10999',
        city: 'Berlin',
        email: 'j@x.de',
      },
      images: [{ id: 1, alt: { de: 'Schale', en: 'Bowl' } }],
      declarations: [],
      now: new Date('2026-10-12T10:00:00Z'),
    }
    expect(validateForPublish(base, ctx)).toEqual([])
    const estimated = {
      ...base,
      dimensions: { ...base.dimensions, note: { de: 'ca. 8 cm', en: 'approx. 8 cm – estimated' } },
    }
    const issues = validateForPublish(estimated, ctx)
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ field: 'dimensions.note' })
    expect(issues[0]!.message).toMatch(/^Bitte erst nachmessen/)
  })

  it('Bestandsliste (U-76/U-86): jedes „– geschätzt“ im Maß-Hinweis sperrt in DE und EN – geschätzte Stücke bleiben Entwürfe', () => {
    const products = JSON.parse(readFileSync('content/bestand/products.json', 'utf8')) as {
      itemNumber: number
      dimensions: { note?: { de: string; en: string } }
    }[]
    const estimated = products.filter((p) => /geschätzt/i.test(p.dimensions.note?.de ?? ''))
    expect(estimated.length).toBeGreaterThan(0)
    for (const p of estimated) {
      const locales = measurementIssues({ dimensions: { note: p.dimensions.note } }).map(
        (i) => i.locale,
      )
      expect(locales, `Nr. ${p.itemNumber}`).toEqual(['de', 'en'])
    }
  })
})

describe('V-15 Größenvergleich für sehr kleine Stücke', () => {
  it.each([
    [{ widthCm: 1.2, heightCm: 0.8 }, 'belowCent'],
    [{ widthCm: 1.6, heightCm: 1.6, depthCm: 0.7 }, 'cent'],
    [{ widthCm: 1.7, heightCm: 2.1, depthCm: 1.6 }, 'euro1'],
    [{ diameterCm: 2.6, heightCm: 2.8 }, 'euro2'],
    [{ widthCm: 3, heightCm: 2.5, depthCm: 1.5 }, 'walnut'],
    [{ widthCm: 2.5, heightCm: 4, depthCm: 1 }, null],
    [{ widthCm: 8, heightCm: 6.5 }, null],
    [{}, null],
    [null, null],
  ] as const)('%j → %s', (dims, key) => {
    expect(sizeComparison(dims)).toBe(key)
  })

  it('größte Abmessung zählt, ungültige Werte zählen nicht; Bänder aufsteigend bis < 4 cm', () => {
    expect(largestDimension({ widthCm: 0, heightCm: -1, diameterCm: Number.NaN })).toBeNull()
    expect(largestDimension({ widthCm: 1, depthCm: 3.9 })).toBe(3.9)
    const limits = SIZE_COMPARE_BANDS.map((b) => b.below)
    expect([...limits].sort((a, b) => a - b)).toEqual(limits)
    expect(limits.at(-1)).toBe(SIZE_COMPARE_MAX_CM)
  })

  it('jeder Vergleich hat einen Satz auf Deutsch und Englisch (U-00)', () => {
    const deTexts = (de as { shop: { product: { sizeCompare: Record<string, string> } } }).shop
      .product.sizeCompare
    const enTexts = (en as { shop: { product: { sizeCompare: Record<string, string> } } }).shop
      .product.sizeCompare
    for (const { key } of SIZE_COMPARE_BANDS) {
      expect(deTexts[key], key).toMatch(/\S/)
      expect(enTexts[key], key).toMatch(/\S/)
    }
  })
})
