import { describe, expect, it } from 'vitest'

import {
  COMMISSION_SIMILAR_FIELD,
  commissionHref,
  objectTypeForProduct,
  parseCommissionParams,
  parseSimilarTo,
} from '@/lib/commission/link'
import { loadBestand } from '@/lib/bestand/schema'
import { INQUIRY_OBJECT_TYPES } from '@/lib/enums'

// P20.3 (V-11 a, V-20; U-93): Links auf das Anfrageformular mit Vorauswahl – `?art=` (Gegenstand) und `?nach=` (Nummer
// des verkauften Stücks). Ungültiges wird stillschweigend ignoriert.

describe('Anfrage-Links (V-11 a, V-20)', () => {
  it('commissionHref: Zeichnung auf Anfrage, Etwas Ähnliches mit Nummer, ohne Vorauswahl', () => {
    expect(commissionHref('de', { objectType: 'zeichnung' })).toBe(
      '/de/auftragsarbeiten?art=zeichnung',
    )
    expect(commissionHref('en', { objectType: 'zeichnung' })).toBe('/en/commissions?art=zeichnung')
    expect(commissionHref('de', { similarTo: 115 })).toBe('/de/auftragsarbeiten?nach=115')
    expect(commissionHref('de')).toBe('/de/auftragsarbeiten')
    expect(commissionHref('de', { similarTo: 0 })).toBe('/de/auftragsarbeiten')
    expect(COMMISSION_SIMILAR_FIELD).toBe('nach')
  })

  it('parseCommissionParams: nur bekannte Gegenstände und gültige Nummern, erster Wert zählt', () => {
    expect(parseCommissionParams({ art: 'zeichnung', nach: '115' })).toEqual({
      objectType: 'zeichnung',
      similarTo: 115,
    })
    expect(parseCommissionParams({ art: ['schale', 'tasse'] })).toEqual({ objectType: 'schale' })
    for (const bad of ['', 'Zeichnung', 'drawing', '<b>', 'sonstiges2'])
      expect(parseCommissionParams({ art: bad }), bad).toEqual({})
    for (const bad of ['0', '-1', '1.5', 'abc', '1234567', '115x', ''])
      expect(parseSimilarTo(bad), bad).toBeUndefined()
    expect(parseSimilarTo(' 0115 ')).toBe(115)
    expect(parseCommissionParams(undefined)).toEqual({})
  })

  it('objectTypeForProduct: Kategorie eindeutig, sonst aus dem Namen; ohne Treffer keine Vorauswahl', () => {
    expect(objectTypeForProduct('zeichnung')).toBe('zeichnung')
    expect(objectTypeForProduct('cap', 'Cap „Fledermaus“')).toBe('cap')
    expect(objectTypeForProduct('schmuck', 'Anhänger „Katze“')).toBe('schmuck')
    expect(objectTypeForProduct('keramik', 'Schälchen „Hai, kommt von unten“')).toBe('schale')
    expect(objectTypeForProduct('keramik', 'Henkelschälchen „Innen Seestern“')).toBe('schale')
    expect(objectTypeForProduct('keramik', 'Zweihenkelbecher „Gebiss“')).toBe('tasse')
    expect(objectTypeForProduct('keramik', 'Kachel „Nickerchen im Gras“')).toBe('fliese')
    expect(objectTypeForProduct('keramik', 'Wandtasche „Hund mit Blume“')).toBeUndefined()
    expect(objectTypeForProduct('keramik', 'Figur „Schlange“')).toBeUndefined()
    expect(objectTypeForProduct('textil', 'T-Shirt „Fledermaus“')).toBe('shirt')
    expect(objectTypeForProduct('textil', 'Stoffbeutel „Vogel in Jeans“')).toBe('textil_sonstiges')
    expect(objectTypeForProduct('sonstiges', 'Irgendwas')).toBeUndefined()
    // ohne Namen (leere Station auf der Startseite): nur die eindeutigen Kategorien
    expect(objectTypeForProduct('textil')).toBeUndefined()
    expect(objectTypeForProduct('keramik', '  ')).toBeUndefined()
    expect(objectTypeForProduct('cap')).toBe('cap')
  })

  it('jede Vorauswahl für den echten Bestand ist ein gültiger Gegenstand', async () => {
    for (const p of await loadBestand()) {
      const t = objectTypeForProduct(p.category, p.title.de)
      if (t) expect(INQUIRY_OBJECT_TYPES).toContain(t)
    }
  })
})
