import { describe, expect, it } from 'vitest'

import { ENUM_LABELS } from '@/lib/enumLabels'
import { PRODUCT_CATEGORIES, TEXTILE_FIBERS, type ProductCategory } from '@/lib/enums'
import { lintProductText } from '@/lib/legal/forbidden'
import { checkFibers, TEXTILE_FIBER_ANNEX } from '@/lib/products/fibers'
import {
  checkFoodContact,
  validateForPublish,
  type ProductForValidation,
  type PublishContext,
} from '@/lib/products/validate'
import { MANDATORY_WARNING_TEXTS } from '@/lib/products/warnings'

// P1.18: Veröffentlichungsprüfung je Kategorie (DATENMODELL §6.6.6, R-042–R-048) als Tabellentests.

const NOW = new Date('2026-09-27T10:00:00.000Z')
const SMALL_PARTS = MANDATORY_WARNING_TEXTS['product.jewelrySmallParts'].de
const GLASS = MANDATORY_WARNING_TEXTS['product.glassFrame'].de

function ctx(overrides: Partial<PublishContext> = {}): PublishContext {
  return {
    allowVisibleBlankBrands: false,
    business: {
      legalName: 'Jutta Beispiel',
      street: 'Musterstraße 1',
      postalCode: '10999',
      city: 'Berlin',
      email: 'jutta@planetclairetattoos.com',
    },
    images: [{ id: 1, alt: { de: 'Blaue Schale', en: 'Blue bowl' }, restricted: false }],
    declarations: [{ id: 7, status: 'active', validFrom: '2026-09-01T00:00:00.000Z' }],
    now: NOW,
    ...overrides,
  }
}

function complete(category: ProductCategory): ProductForValidation {
  const base: ProductForValidation = {
    itemNumber: 17,
    category,
    title: { de: 'Schale mit Hund', en: 'Bowl with dog' },
    description: { de: 'Handbemalte Schale aus dem Atelier in Berlin.' },
    priceCents: 4500,
    vatCategory: 'standard',
    materials: { de: 'Steinzeug, Unterglasurfarbe' },
    dimensions: { diameterCm: 14 },
    weightGrams: 400,
    shippingClass: 'paket_klein',
    safetyWarnings: { de: 'Zerbrechlich.' },
    ownDesignConfirmed: true,
    images: [1],
    deviationDecision: 'none',
    hasDeviation: false,
  }
  const extra: Record<ProductCategory, ProductForValidation> = {
    keramik: { foodContact: 'deko' },
    textil: {
      dimensions: null,
      sizeLabel: { de: 'M' },
      condition: 'good',
      fiberComposition: [{ component: 'main', fiber: 'cotton', percent: 100 }],
      blankBrandVisible: false,
    },
    cap: {
      dimensions: {},
      sizeLabel: 'Einheitsgröße',
      condition: 'very_good',
      fiberComposition: [
        { component: 'main', fiber: 'cotton', percent: 60 },
        { component: 'main', fiber: 'polyester', percent: 40 },
      ],
      blankBrandVisible: false,
    },
    zeichnung: { framed: false, frameHasGlass: false },
    schmuck: {
      metalPartsMaterial: { de: 'Edelstahl 316L' },
      nickelFreeConfirmed: true,
      nickelEvidence: 3,
      leadFreeGlazeConfirmed: true,
      smallPartsWarning: true,
      safetyWarnings: { de: `Zerbrechlich.\n\n${SMALL_PARTS}` },
    },
    sonstiges: {},
  }
  return { ...base, ...extra[category] }
}

const fields = (p: ProductForValidation, c = ctx()) => validateForPublish(p, c).map((i) => i.field)

describe('R-042 Veröffentlichungsprüfung je Kategorie (DM-PROD-01)', () => {
  it.each(PRODUCT_CATEGORIES)('R-042 %s: vollständig → veröffentlichbar', (category) => {
    expect(validateForPublish(complete(category), ctx())).toEqual([])
  })

  const COMMON: [string, Partial<ProductForValidation>][] = [
    ['itemNumber', { itemNumber: null }],
    ['title', { title: { en: 'Only English' } }],
    ['description', { description: { de: '  ' } }],
    ['priceCents', { priceCents: null }],
    ['materials', { materials: null }],
    ['weightGrams', { weightGrams: null }],
    ['shippingClass', { shippingClass: null }],
    ['safetyWarnings', { safetyWarnings: { en: 'Fragile.' } }],
    ['ownDesignConfirmed', { ownDesignConfirmed: false }],
    ['images', { images: [] }],
  ]
  const cases = PRODUCT_CATEGORIES.flatMap((category) =>
    COMMON.map(([field, patch]) => [category, field, patch] as const),
  )
  it.each(cases)(
    'R-042 %s ohne %s wird abgelehnt (Feldname in der Meldung)',
    (category, field, patch) => {
      const issues = validateForPublish({ ...complete(category), ...patch }, ctx())
      expect(issues.map((i) => i.field)).toContain(field)
      expect(issues.find((i) => i.field === field)!.message.length).toBeGreaterThan(5)
    },
  )

  it('R-042 Bilder: Alt-Text DE und EN, nicht gesperrt, höchstens 12, vorhanden', () => {
    const p = complete('keramik')
    expect(fields(p, ctx({ images: [{ id: 1, alt: { de: 'Schale' } }] }))).toContain('images')
    expect(fields(p, ctx({ images: [{ id: 1, alt: { en: 'Bowl' } }] }))).toContain('images')
    expect(
      fields(p, ctx({ images: [{ id: 1, alt: { de: 'Schale', en: 'Bowl' }, restricted: true }] })),
    ).toContain('images')
    expect(fields(p, ctx({ images: [] }))).toContain('images')
    expect(fields({ ...p, images: Array.from({ length: 13 }, () => 1) })).toContain('images')
  })

  it.each(['keramik', 'zeichnung', 'schmuck', 'sonstiges'] as const)(
    'R-042 %s ohne Maß wird abgelehnt',
    (category) => {
      expect(fields({ ...complete(category), dimensions: { widthCm: null } })).toContain(
        'dimensions',
      )
    },
  )

  it('R-042 Herstellerangaben in settings.business müssen vollständig sein (GPSR)', () => {
    const issues = validateForPublish(
      complete('sonstiges'),
      ctx({ business: { legalName: 'Jutta', street: '', city: 'Berlin' } }),
    )
    expect(issues.map((i) => i.field)).toEqual(['business'])
    expect(issues[0]!.message).toMatch(/Straße, PLZ, E-Mail/)
  })
})

describe('R-043 Textil und Cap: Faserangabe, Größe, Zustand', () => {
  it.each(['textil', 'cap'] as const)(
    'R-043 %s ohne Größe/Zustand/Fasern abgelehnt',
    (category) => {
      expect(fields({ ...complete(category), sizeLabel: null })).toContain('sizeLabel')
      expect(fields({ ...complete(category), condition: null })).toContain('condition')
      expect(fields({ ...complete(category), fiberComposition: [] })).toContain('fiberComposition')
    },
  )

  it('R-043 DM-PROD-02 Summe 99 % oder 101 % abgelehnt, 60/40 angenommen', () => {
    const row = (fiber: string, percent: number) => ({ component: 'main', fiber, percent })
    expect(checkFibers([row('cotton', 60), row('polyester', 39)])[0]!.message).toMatch(/Summe 99 %/)
    expect(checkFibers([row('cotton', 60), row('polyester', 41)])[0]!.message).toMatch(
      /Summe 101 %/,
    )
    expect(checkFibers([row('cotton', 60), row('polyester', 40)])).toEqual([])
    expect(checkFibers([row('cotton', 100)])).toEqual([])
  })

  it('R-043 unbekannte Faser, doppelte Faser, kein Hauptstoff, sonstige Fasern > 15 % abgelehnt', () => {
    expect(checkFibers([{ component: 'main', fiber: 'Baumwolle', percent: 100 }])).toHaveLength(1)
    expect(
      checkFibers([
        { component: 'main', fiber: 'cotton', percent: 50 },
        { component: 'main', fiber: 'cotton', percent: 50 },
      ]),
    ).toHaveLength(1)
    expect(
      checkFibers([{ component: 'lining', fiber: 'viscose', percent: 100 }])[0]!.message,
    ).toMatch(/Hauptstoff/)
    expect(
      checkFibers([
        { component: 'main', fiber: 'cotton', percent: 80 },
        { component: 'main', fiber: 'other_fibres', percent: 20 },
      ])[0]!.message,
    ).toMatch(/höchstens 15 %/)
    expect(
      checkFibers([
        { component: 'main', fiber: 'cotton', percent: 100 },
        { component: 'lining', fiber: 'polyester', percent: 90 },
      ])[0]!.message,
    ).toMatch(/Futter.*Summe 90 %/)
  })

  it('R-043 DM-PROD-02 labelMissing: ohne fiberFreeText oder ohne Faserangabe abgelehnt', () => {
    const textile = { ...complete('textil'), labelMissing: true }
    expect(fields(textile)).toEqual(['fiberFreeText'])
    expect(
      fields({ ...textile, fiberFreeText: { de: 'wohl Baumwolle' }, fiberComposition: [] }),
    ).toEqual(['fiberComposition'])
    expect(fields({ ...textile, fiberFreeText: { de: 'wohl Baumwolle' } })).toEqual([])
    expect(fields({ ...textile, fiberFreeText: { en: 'probably cotton' } })).toEqual([
      'fiberFreeText',
    ])
  })

  it('R-043 Liste amtlicher Fasern: jeder Wert mit Anhang-Nummer und deutscher Bezeichnung', () => {
    for (const fiber of TEXTILE_FIBERS) {
      expect(fiber in TEXTILE_FIBER_ANNEX, fiber).toBe(true)
      expect(ENUM_LABELS.TEXTILE_FIBERS[fiber].de.length).toBeGreaterThan(2)
    }
    expect(ENUM_LABELS.TEXTILE_FIBERS.chlorofibre.de).toBe('Polychlorid')
    expect(ENUM_LABELS.TEXTILE_FIBERS.polycarbamide.de).toBe('Polyharnstoff')
    expect(TEXTILE_FIBER_ANNEX.polyacrylate).toBe(50)
  })
})

describe('R-044 Keramik: Lebensmittelkontakt', () => {
  it('R-044 ohne foodContact abgelehnt', () => {
    expect(fields({ ...complete('keramik'), foodContact: null })).toContain('foodContact')
  })

  it('R-044 DM-PROD-03 lebensmittelecht: ohne, mit widerrufener, mit künftiger Erklärung abgelehnt; mit aktiver angenommen', () => {
    const food = { ...complete('keramik'), foodContact: 'lebensmittelecht' }
    expect(checkFoodContact(food, ctx())).toHaveLength(1)
    expect(
      checkFoodContact(
        { ...food, conformityDeclarations: [7] },
        ctx({
          declarations: [{ id: 7, status: 'revoked', validFrom: '2026-09-01T00:00:00.000Z' }],
        }),
      ),
    ).toHaveLength(1)
    expect(
      checkFoodContact(
        { ...food, conformityDeclarations: [7] },
        ctx({
          declarations: [{ id: 7, status: 'active', validFrom: '2026-10-01T00:00:00.000Z' }],
        }),
      ),
    ).toHaveLength(1)
    expect(checkFoodContact({ ...food, conformityDeclarations: [{ id: 7 }] }, ctx())).toEqual([])
    expect(fields({ ...food, conformityDeclarations: [7] })).toEqual([])
  })

  it('R-044 V-13: Lebensmittel-Versprechen im Text abgelehnt, verneint erlaubt', () => {
    for (const text of [
      'Spülmaschinenfest und mikrowellengeeignet',
      'Lebensmittelecht glasiert',
      'Perfekt für Speisen',
      'Food safe and dishwasher safe',
      'Labor geprüft',
    ]) {
      expect(fields({ ...complete('keramik'), description: { de: text } }), text).toContain(
        'description',
      )
    }
    expect(
      fields({ ...complete('keramik'), description: { de: 'Deko, nicht lebensmittelecht.' } }),
    ).toEqual([])
    expect(
      fields({ ...complete('keramik'), description: { de: 'Nur Deko, nicht für Speisen.' } }),
    ).toEqual([])
  })
})

describe('R-045 Schmuck: Nickel, Blei, Kleinteile', () => {
  it.each([
    ['metalPartsMaterial', { metalPartsMaterial: null }],
    ['nickelFreeConfirmed', { nickelFreeConfirmed: false }],
    ['nickelEvidence', { nickelEvidence: null }],
    ['leadFreeGlazeConfirmed', { leadFreeGlazeConfirmed: false }],
    ['smallPartsWarning', { smallPartsWarning: false }],
    ['safetyWarnings', { safetyWarnings: { de: 'Zerbrechlich.' } }],
  ] as const)('R-045 DM-PROD-04 ohne %s abgelehnt', (field, patch) => {
    expect(fields({ ...complete('schmuck'), ...patch })).toContain(field)
  })

  it('R-045 „nickelfrei“/„bleifrei“ nicht im Freitext (V-13)', () => {
    expect(fields({ ...complete('schmuck'), title: { de: 'Nickelfreie Ohrringe' } })).toContain(
      'title',
    )
    expect(fields({ ...complete('schmuck'), title: { de: 'Ohrringe mit Nickelbügel' } })).toEqual(
      [],
    )
    expect(fields({ ...complete('schmuck'), title: { de: 'Ohrringe nickelfrei' } })).toContain(
      'title',
    )
    expect(
      fields({ ...complete('schmuck'), materials: { en: 'lead-free glaze', de: 'Glasur' } }),
    ).toContain('materials')
  })
})

describe('R-046 Zeichnung: Rahmen, Glas, Steuersatz', () => {
  it('R-046 framed nicht gesetzt abgelehnt', () => {
    expect(fields({ ...complete('zeichnung'), framed: null })).toContain('framed')
  })

  it('R-046 DM-PROD-09 frameHasGlass verlangt den Glas-Hinweis in den Warnhinweisen', () => {
    const glass = { ...complete('zeichnung'), framed: true, frameHasGlass: true }
    expect(fields(glass)).toContain('safetyWarnings')
    expect(fields({ ...glass, safetyWarnings: { de: `Zerbrechlich.\n\n${GLASS}` } })).toEqual([])
  })

  it('R-046 reduced_art nur bei Zeichnungen und mit Begründung', () => {
    const reduced = { vatCategory: 'reduced_art', vatReducedReason: 'Originalzeichnung von Hand' }
    expect(fields({ ...complete('zeichnung'), ...reduced })).toEqual([])
    expect(fields({ ...complete('keramik'), ...reduced })).toContain('vatCategory')
    expect(fields({ ...complete('zeichnung'), ...reduced, vatReducedReason: '' })).toContain(
      'vatReducedReason',
    )
  })
})

describe('R-047 Nur eigene Motive, keine fremden Marken', () => {
  it.each(PRODUCT_CATEGORIES)('R-047 %s ohne ownDesignConfirmed abgelehnt', (category) => {
    expect(fields({ ...complete(category), ownDesignConfirmed: null })).toContain(
      'ownDesignConfirmed',
    )
  })

  it('R-047 DM-PROD-09 fremde Figuren/Marken (V-16) in Titel oder Beschreibung, DE und EN', () => {
    expect(fields({ ...complete('keramik'), title: { de: 'Godzilla-Schale' } })).toContain('title')
    expect(
      fields({ ...complete('cap'), description: { de: 'Ein altes Nike-Cap, neu bemalt.' } }),
    ).toContain('description')
    expect(fields({ ...complete('textil'), title: { de: 'Shirt', en: 'Disney shirt' } })).toContain(
      'title',
    )
    expect(lintProductText('Pokemon und Hello Kitty').map((h) => h.label)).toEqual([
      'Pokémon',
      'Hello Kitty',
    ])
    expect(lintProductText('Pumakatze? Nein: Pumpernickel')).toEqual([])
  })

  it.each(['textil', 'cap'] as const)(
    'R-047 DM-PROD-09 %s mit blankBrandVisible nur bei allowVisibleBlankBrands',
    (category) => {
      const branded = { ...complete(category), blankBrandVisible: true }
      expect(fields(branded)).toEqual(['blankBrandVisible'])
      expect(fields(branded, ctx({ allowVisibleBlankBrands: true }))).toEqual([])
    },
  )
})

describe('R-048 Abweichende Beschaffenheit', () => {
  it.each(['textil', 'cap'] as const)(
    'R-048 DM-PROD-09 %s ohne deviationDecision abgelehnt',
    (category) => {
      expect(fields({ ...complete(category), deviationDecision: null })).toEqual([
        'deviationDecision',
      ])
    },
  )

  it('R-048 andere Kategorien brauchen keine Entscheidung', () => {
    expect(fields({ ...complete('keramik'), deviationDecision: null })).toEqual([])
  })

  it.each(PRODUCT_CATEGORIES)(
    'R-048 %s: hasDeviation verlangt deviationDescription (DE)',
    (category) => {
      const p = { ...complete(category), deviationDecision: 'described', hasDeviation: true }
      expect(fields(p)).toContain('deviationDescription')
      expect(fields({ ...p, deviationDescription: { de: 'kleiner Fleck am Ärmel' } })).toEqual([])
    },
  )
})
