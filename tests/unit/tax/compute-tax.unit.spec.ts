import { describe, expect, it } from 'vitest'

import { computeTax, splitShippingByRate, type VatRate } from '@/lib/tax'

// AK-4-15 (Rechenteil), KONZEPT §4.14, KA-10 (P4.2): KU → keine Steuerzeilen; Regelbesteuerung → Netto =
// round(Brutto / (1 + Satz)) je Satz, Versand anteilig nach Warenwert, Netto + Steuer = Brutto centgenau.

describe('computeTax mit Versand (AK-4-15, KA-10)', () => {
  const lines = [
    { grossCents: 4500, vatCategory: 'standard' as const },
    { grossCents: 12000, vatCategory: 'reduced_art' as const },
  ]

  it('AK-4-15 KU-Modus: kein Steuerbetrag, keine Steuerzeilen, Versand im Brutto enthalten', () => {
    expect(computeTax(lines, 'kleinunternehmer', { shippingCents: 890 })).toEqual({
      mode: 'kleinunternehmer',
      taxLines: [],
      shippingShares: [],
      totalGrossCents: 17390,
      totalNetCents: 17390,
      totalTaxCents: 0,
    })
  })

  it('AK-4-15 KA-10 Regelbesteuerung 19/7 %: Versand anteilig nach Warenwert, centgenau', () => {
    const r = computeTax(lines, 'regelbesteuert', { shippingCents: 890 })
    expect(r.shippingShares).toEqual([
      { rate: 19, grossCents: 243 },
      { rate: 7, grossCents: 647 },
    ])
    expect(r.taxLines).toEqual([
      { rate: 19, grossCents: 4743, netCents: 3986, taxCents: 757 },
      { rate: 7, grossCents: 12647, netCents: 11820, taxCents: 827 },
    ])
    expect(r.totalGrossCents).toBe(17390)
    expect(r.totalNetCents + r.totalTaxCents).toBe(r.totalGrossCents)
  })

  it('KA-10 nur ein Satz im Korb: der ganze Versand folgt diesem Satz', () => {
    const r = computeTax([{ grossCents: 12000, vatCategory: 'reduced_art' }], 'regelbesteuert', {
      shippingCents: 450,
    })
    expect(r.shippingShares).toEqual([{ rate: 7, grossCents: 450 }])
    expect(r.taxLines).toEqual([{ rate: 7, grossCents: 12450, netCents: 11636, taxCents: 814 }])
  })

  it('KA-10 ohne Versand (Abholung) keine Versandanteile', () => {
    const r = computeTax(lines, 'regelbesteuert', { shippingCents: 0 })
    expect(r.shippingShares).toEqual([])
    expect(r.totalGrossCents).toBe(16500)
    expect(computeTax(lines, 'regelbesteuert')).toEqual(r)
  })

  it('KA-10 Rest-Cent nach größtem Divisionsrest, bei Gleichstand an den Regelsatz', () => {
    const tie = splitShippingByRate(
      new Map<VatRate, number>([
        [7, 1000],
        [19, 1000],
      ]),
      1,
    )
    expect(tie).toEqual([
      { rate: 19, grossCents: 1 },
      { rate: 7, grossCents: 0 },
    ])
    expect(splitShippingByRate(new Map<VatRate, number>(), 890)).toEqual([
      { rate: 19, grossCents: 890 },
    ])
  })

  it('AK-4-15 Netto + Steuer = Brutto und Σ Versandanteile = Versand für viele Beträge', () => {
    for (let a = 1; a <= 20_000; a += 997) {
      for (let b = 0; b <= 30_000; b += 1_499) {
        for (const shippingCents of [0, 1, 450, 650, 890, 1_999]) {
          const input = [
            { grossCents: a, vatCategory: 'standard' as const },
            ...(b > 0 ? [{ grossCents: b, vatCategory: 'reduced_art' as const }] : []),
          ]
          const r = computeTax(input, 'regelbesteuert', { shippingCents })
          expect(r.totalGrossCents).toBe(a + b + shippingCents)
          expect(r.shippingShares.reduce((n, s) => n + s.grossCents, 0)).toBe(shippingCents)
          for (const t of r.taxLines) {
            expect(Number.isSafeInteger(t.netCents) && Number.isSafeInteger(t.taxCents)).toBe(true)
            expect(t.netCents + t.taxCents).toBe(t.grossCents)
          }
          expect(r.totalNetCents + r.totalTaxCents).toBe(r.totalGrossCents)
        }
      }
    }
  })

  it('Versandkosten nur als ganze Cent ≥ 0', () => {
    expect(() => computeTax(lines, 'regelbesteuert', { shippingCents: 8.9 })).toThrow()
    expect(() => computeTax(lines, 'kleinunternehmer', { shippingCents: -1 })).toThrow()
  })
})
