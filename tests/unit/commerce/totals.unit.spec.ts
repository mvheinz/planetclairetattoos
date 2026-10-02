import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { DEFAULT_SHIPPING_RATES } from '@/globals/settingsDefaults'
import { computeTotals, type TotalsInput } from '@/lib/commerce/totals'
import { CHECKOUT_PAYMENT_CHOICES, PAYMENT_METHODS } from '@/lib/enums'

// R-070, AK-4-15 (Rechenteil), P4.2: Summen unabhängig von der Zahlart; KU ohne Steuer; Regelbesteuerung mit
// Versandaufteilung (KA-10).

const X = '2027-03-01T00:00:00.000Z'
const settings = {
  shipping: { rates: DEFAULT_SHIPPING_RATES, enabledCountries: ['DE'] },
  tax: {
    modes: [
      { mode: 'kleinunternehmer' as const, validFrom: '2026-01-01T00:00:00.000Z' },
      { mode: 'regelbesteuert' as const, validFrom: X },
    ],
  },
}
const items: TotalsInput['items'] = [
  { itemNumber: 17, priceCents: 4500, vatCategory: 'standard', shippingClass: 'brief' },
  { itemNumber: 21, priceCents: 12000, vatCategory: 'reduced_art', shippingClass: 'keramik' },
]
const base: TotalsInput = {
  items,
  fulfillmentMethod: 'shipping',
  at: new Date('2026-10-15T08:00:00.000Z'),
}

describe('computeTotals (R-070, AK-4-15)', () => {
  it('Zwischensumme + Versand = Gesamt; Versand aus der höchsten Klasse', () => {
    const t = computeTotals(base, settings)
    expect(t).toMatchObject({
      subtotalCents: 16500,
      shippingCents: 890,
      totalCents: 17390,
      taxMode: 'kleinunternehmer',
    })
    expect(t.shipping.label.de).toBe('DHL Paket (Keramik)')
    const pickup = computeTotals({ ...base, fulfillmentMethod: 'pickup' }, settings)
    expect(pickup).toMatchObject({ shippingCents: 0, totalCents: 16500 })
  })

  it('R-070 gleicher Gesamtbetrag für jede Zahlart (Karte, PayPal, Vorkasse)', () => {
    const reference = computeTotals(base, settings)
    for (const method of [...PAYMENT_METHODS, ...CHECKOUT_PAYMENT_CHOICES]) {
      const withMethod = { ...base, paymentMethod: method, paymentChoice: method } as TotalsInput
      expect(computeTotals(withMethod, settings), method).toEqual(reference)
    }
    // Die Zahlart ist kein Eingabewert: totals.ts liest keine Zahlart (auch nicht über Umwege).
    const source = readFileSync(
      path.resolve(__dirname, '../../../src/lib/commerce/totals.ts'),
      'utf8',
    )
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
    expect(source).not.toMatch(/payment|surcharge|\bfees?\b|discount/i)
  })

  it('AK-4-15 im KU-Modus kein Steuerbetrag und keine Steuerzeilen', () => {
    const t = computeTotals(base, settings)
    expect(t.tax).toEqual({
      mode: 'kleinunternehmer',
      taxLines: [],
      shippingShares: [],
      totalGrossCents: 17390,
      totalNetCents: 17390,
      totalTaxCents: 0,
    })
  })

  it('AK-4-15 Regelbesteuerung ab X: 19/7 % mit Versandaufteilung, Netto + Steuer = Brutto centgenau', () => {
    const t = computeTotals({ ...base, at: new Date(X) }, settings)
    expect(t.taxMode).toBe('regelbesteuert')
    expect(t.totalCents).toBe(17390)
    // Versand 890 anteilig: 890 × 4500/16500 = 242,7 → 243 (19 %), 890 × 12000/16500 = 647,3 → 647 (7 %)
    expect(t.tax.shippingShares).toEqual([
      { rate: 19, grossCents: 243 },
      { rate: 7, grossCents: 647 },
    ])
    expect(t.tax.taxLines).toEqual([
      { rate: 19, grossCents: 4743, netCents: 3986, taxCents: 757 },
      { rate: 7, grossCents: 12647, netCents: 11820, taxCents: 827 },
    ])
    expect(t.tax.totalNetCents + t.tax.totalTaxCents).toBe(t.totalCents)
    for (const line of t.tax.taxLines) expect(line.netCents + line.taxCents).toBe(line.grossCents)
  })

  it('lehnt ungültige Preise ab (Integer-Cent > 0)', () => {
    const bad = (priceCents: number) =>
      computeTotals({ ...base, items: [{ ...items[0]!, priceCents }] }, settings)
    expect(() => bad(0)).toThrow()
    expect(() => bad(-100)).toThrow()
    expect(() => bad(12.5)).toThrow()
  })

  it('R-060 Lieferland außerhalb der Whitelist → Fehler; Abholung ohne Land', () => {
    expect(() => computeTotals({ ...base, country: 'AT' }, settings)).toThrow(/nicht möglich/)
    expect(
      computeTotals({ ...base, fulfillmentMethod: 'pickup', country: 'AT' }, settings).totalCents,
    ).toBe(16500)
  })
})
