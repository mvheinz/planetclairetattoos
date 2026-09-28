import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  checkMoneyFormatting,
  moneyUsageInput,
} from '../../../scripts/lib/static-checks/money-usage'
import { formatMoney } from '@/lib/money'
import {
  formatCondition,
  formatDimensions,
  formatFibers,
  formatItemNumber,
  formatWeight,
  productPath,
} from '@/lib/shop/format'

// P3.1 Anzeige-Formatierer des Shops (ARCHITEKTUR §2.1, KONZEPT §3.4, DESIGN DA-9, R-043) und Geld nur über
// `formatMoney` (ARCHITEKTUR §15.4).

const ROOT = path.resolve(import.meta.dirname, '../../..')
const NB = ' '

describe('formatItemNumber (E-12, R-041)', () => {
  it('17 → „Nr. 017“/„No. 017“, 999 dreistellig, ab 1000 ohne Auffüllen', () => {
    expect(formatItemNumber(17, 'de')).toBe('Nr. 017')
    expect(formatItemNumber(17, 'en')).toBe('No. 017')
    expect(formatItemNumber(999, 'de')).toBe('Nr. 999')
    expect(formatItemNumber(1000, 'de')).toBe('Nr. 1000')
    expect(formatItemNumber(1000, 'en')).toBe('No. 1000')
  })
})

describe('formatDimensions', () => {
  it('„Ø 14 cm, H 6 cm“ (KONZEPT §3.4) und EN-Kürzel', () => {
    expect(formatDimensions({ diameterCm: 14, heightCm: 6 }, 'de')).toBe('Ø 14 cm, H 6 cm')
    expect(formatDimensions({ widthCm: 21, heightCm: 29.7 }, 'de')).toBe('B 21 cm, H 29,7 cm')
    expect(formatDimensions({ widthCm: 21, heightCm: 29.7, depthCm: 2 }, 'en')).toBe(
      'W 21 cm, H 29.7 cm, D 2 cm',
    )
  })

  it('Notiz hinten an, leere Maße → leer', () => {
    expect(formatDimensions({ note: 'Brustweite 52 cm' }, 'de')).toBe('Brustweite 52 cm')
    expect(formatDimensions({ note: { de: 'Brustweite 52 cm', en: 'Chest 52 cm' } }, 'en')).toBe(
      'Chest 52 cm',
    )
    expect(formatDimensions({}, 'de')).toBe('')
    expect(formatDimensions(null, 'de')).toBe('')
  })
})

describe('formatWeight (DESIGN DA-9)', () => {
  it('210 → „210 g“, 1000 → „1 kg“, 2400 → „2,4 kg“/„2.4 kg“ (geschütztes Leerzeichen)', () => {
    expect(formatWeight(210, 'de')).toBe(`210${NB}g`)
    expect(formatWeight(999, 'en')).toBe(`999${NB}g`)
    expect(formatWeight(1000, 'de')).toBe(`1${NB}kg`)
    expect(formatWeight(1000, 'en')).toBe(`1${NB}kg`)
    expect(formatWeight(2400, 'de')).toBe(`2,4${NB}kg`)
    expect(formatWeight(2400, 'en')).toBe(`2.4${NB}kg`)
    expect(formatWeight(2449, 'de')).toBe(`2,4${NB}kg`)
    expect(formatWeight(2960, 'de')).toBe(`3${NB}kg`)
  })

  it('ohne Gewicht leer', () => {
    expect(formatWeight(null, 'de')).toBe('')
    expect(formatWeight(0, 'de')).toBe('')
  })
})

describe('formatFibers (R-043)', () => {
  it('60/40 absteigend nach Anteil, amtliche Bezeichnung; EN mit englischer Übersetzung in Klammern', () => {
    const rows = [
      { component: 'main', fiber: 'polyester', percent: 40 },
      { component: 'main', fiber: 'cotton', percent: 60 },
    ]
    expect(formatFibers(rows, 'de')).toBe('60 % Baumwolle, 40 % Polyester')
    expect(formatFibers(rows, 'en')).toBe('60 % Baumwolle (cotton), 40 % Polyester (polyester)')
  })

  it('Mehrkomponenten: Hauptstoff, dann Futter mit Präfix', () => {
    const rows = [
      { component: 'lining', fiber: 'polyester', percent: 100 },
      { component: 'main', fiber: 'cotton', percent: 100 },
    ]
    expect(formatFibers(rows, 'de')).toBe('100 % Baumwolle; Futter: 100 % Polyester')
    expect(formatFibers(rows, 'en')).toBe(
      '100 % Baumwolle (cotton); lining: 100 % Polyester (polyester)',
    )
  })
})

describe('formatCondition', () => {
  it('Label je Sprache, optional mit Notiz', () => {
    expect(formatCondition('very_good', 'de')).toBe('sehr gut')
    expect(formatCondition('very_good', 'en')).toBe('very good')
    expect(formatCondition('good', 'de', 'kleiner Fleck am Ärmel')).toBe(
      'gut – kleiner Fleck am Ärmel',
    )
    expect(formatCondition(null, 'de')).toBe('')
  })
})

describe('productPath (KONZEPT §2.3)', () => {
  it('kanonisch /{locale}/shop/{nr}-{slug}, EN-Slug mit Rückfall auf DE', () => {
    expect(productPath({ itemNumber: 17, slug: '017-schale-mit-hund' }, 'de')).toBe(
      '/de/shop/017-schale-mit-hund',
    )
    expect(
      productPath(
        { itemNumber: 17, slug: { de: '017-schale-mit-hund', en: '017-bowl-with-dog' } },
        'en',
      ),
    ).toBe('/en/shop/017-bowl-with-dog')
    expect(productPath({ itemNumber: 17, slug: { de: '017-schale-mit-hund' } }, 'en')).toBe(
      '/en/shop/017-schale-mit-hund',
    )
    expect(productPath({ itemNumber: 1234, slug: '1234-vase' }, 'de')).toBe('/de/shop/1234-vase')
    expect(productPath({ itemNumber: 5, slug: null }, 'de')).toBe('/de/shop/005-stueck')
  })
})

describe('Preise nur über formatMoney (ARCHITEKTUR §15.4)', () => {
  it('4500 → „45 €“/„€45“ mit tag, 5390 → „53,90 €“/„€53.90“ mit full', () => {
    expect(formatMoney(4500, 'de', { style: 'tag' })).toBe(`45${NB}€`)
    expect(formatMoney(4500, 'en', { style: 'tag' })).toBe('€45')
    expect(formatMoney(5390, 'de', { style: 'full' })).toBe(`53,90${NB}€`)
    expect(formatMoney(5390, 'en', { style: 'full' })).toBe('€53.90')
  })

  it('statischer Scan: weder toFixed noch Intl.NumberFormat mit currency in Shop, Komponenten, Seiten', () => {
    expect(checkMoneyFormatting(moneyUsageInput(ROOT)).errors).toEqual([])
    const bad = checkMoneyFormatting([
      { path: 'src/components/shop/X.tsx', source: 'const p = (cents / 100).toFixed(2)' },
      {
        path: 'src/lib/shop/y.ts',
        source: 'new Intl.NumberFormat("de-DE", {\n  style: "currency",\n  currency: "EUR" })',
      },
      { path: 'src/app/(frontend)/[locale]/z.tsx', source: 'Intl.NumberFormat("de-DE").format(3)' },
      { path: 'src/leash/coco.ts', source: 'x.toFixed(1)' },
    ])
    expect(bad.errors).toHaveLength(2)
    expect(bad.errors[0]).toMatch(/components\/shop\/X\.tsx: toFixed/)
    expect(bad.errors[1]).toMatch(/lib\/shop\/y\.ts: Intl\.NumberFormat/)
  })
})
