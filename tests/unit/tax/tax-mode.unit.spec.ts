import { describe, expect, it } from 'vitest'

import { computeTax, getTaxModeAt, VAT_RATES } from '@/lib/tax'

// R-032 / DM-INV-04 (Logik): Steuermodus mit „gültig ab“, Steuerzeilen je Modus (src/lib/tax, einzige Stelle).

const X = '2027-03-01T00:00:00.000Z'
const settings = {
  tax: {
    modes: [
      { mode: 'kleinunternehmer' as const, validFrom: '2026-01-01T00:00:00.000Z' },
      { mode: 'regelbesteuert' as const, validFrom: X },
    ],
  },
}

describe('getTaxModeAt (R-032)', () => {
  it('R-032 DM-INV-04 liefert vor X Kleinunternehmer und ab X Regelbesteuerung', () => {
    expect(getTaxModeAt(settings, new Date('2026-10-01T10:00:00Z'))).toBe('kleinunternehmer')
    expect(getTaxModeAt(settings, new Date('2027-02-28T22:59:59.999Z'))).toBe('kleinunternehmer')
    expect(getTaxModeAt(settings, new Date(X))).toBe('regelbesteuert')
    expect(getTaxModeAt(settings, new Date('2030-01-01T00:00:00Z'))).toBe('regelbesteuert')
  })

  it('R-032 Reihenfolge der Einträge spielt keine Rolle; ohne Einträge gilt der Grund-Seed (E-02)', () => {
    const reversed = { tax: { modes: [...settings.tax.modes].reverse() } }
    expect(getTaxModeAt(reversed, new Date('2026-12-24T12:00:00Z'))).toBe('kleinunternehmer')
    expect(getTaxModeAt(reversed, new Date('2027-12-24T12:00:00Z'))).toBe('regelbesteuert')
    expect(getTaxModeAt({}, new Date('2026-12-24T12:00:00Z'))).toBe('kleinunternehmer')
    expect(getTaxModeAt(null, new Date('2026-12-24T12:00:00Z'))).toBe('kleinunternehmer')
  })
})

describe('computeTax (R-032)', () => {
  const lines = [
    { grossCents: 4500, vatCategory: 'standard' as const },
    { grossCents: 12000, vatCategory: 'reduced_art' as const },
    { grossCents: 890, vatCategory: 'standard' as const },
  ]

  it('R-032 Kleinunternehmer-Modus ergibt 0 Steuer und keine Steuerzeilen', () => {
    expect(computeTax(lines, 'kleinunternehmer')).toEqual({
      mode: 'kleinunternehmer',
      taxLines: [],
      shippingShares: [],
      totalGrossCents: 17390,
      totalNetCents: 17390,
      totalTaxCents: 0,
    })
  })

  it('R-032 Regelbesteuerung: Netto = round(Brutto / (1 + Satz)) je Satz, Endpreise bleiben', () => {
    const r = computeTax(lines, 'regelbesteuert')
    expect(r.taxLines).toEqual([
      { rate: 19, grossCents: 5390, netCents: 4529, taxCents: 861 },
      { rate: 7, grossCents: 12000, netCents: 11215, taxCents: 785 },
    ])
    expect(r.totalGrossCents).toBe(17390)
    expect(r.totalNetCents + r.totalTaxCents).toBe(17390)
    expect(VAT_RATES).toEqual({ standard: 19, reduced_art: 7 })
  })

  it('nur ganze Cent ≥ 0', () => {
    expect(() =>
      computeTax([{ grossCents: 10.5, vatCategory: 'standard' }], 'kleinunternehmer'),
    ).toThrow()
    expect(() =>
      computeTax([{ grossCents: -1, vatCategory: 'standard' }], 'regelbesteuert'),
    ).toThrow()
  })
})
