import { describe, expect, it } from 'vitest'

import {
  checkPackaging,
  checkRevenueGuard,
  checkShipping,
  checkTaxModes,
  isValidIban,
  isValidPhone,
  POSTBOX_RE,
  taxModeAt,
  zoneForCountry,
} from '@/lib/settings/rules'

// P1.25: Regeln des Globals `settings` (DATENMODELL §7.1) ohne Datenbank.

describe('settings-Regeln', () => {
  it('IBAN-Prüfsumme (Beispiel-IBAN gültig)', () => {
    expect(isValidIban('DE36000000000000000000')).toBe(true)
    expect(isValidIban('DE89 3704 0044 0532 0130 00')).toBe(true)
    expect(isValidIban('DE36000000000000000001')).toBe(false)
    expect(isValidIban('DE3600000000')).toBe(false)
  })

  it('Telefon: Nummer oder genau der Platzhalter; kein Postfach (R-020)', () => {
    expect(isValidPhone('[Telefon folgt]')).toBe(true)
    expect(isValidPhone('+49 30 1234567')).toBe(true)
    expect(isValidPhone('030 1234567')).toBe(true)
    expect(isValidPhone('bald')).toBe(false)
    expect(POSTBOX_RE.test('Postfach 12 34')).toBe(true)
    expect(POSTBOX_RE.test('Pflügerstraße 3')).toBe(false)
  })

  it('R-032 geltender Modus = letzter mit validFrom ≤ Zeitpunkt; neue Einträge brauchen Begründung und Bestätigung', () => {
    const modes = [
      { mode: 'kleinunternehmer' as const, validFrom: '2026-01-01T00:00:00Z' },
      { mode: 'regelbesteuert' as const, validFrom: '2027-01-01T00:00:00Z' },
    ]
    expect(taxModeAt(modes, new Date('2026-12-31T12:00:00Z'))).toBe('kleinunternehmer')
    expect(taxModeAt(modes, new Date('2027-01-01T00:00:00Z'))).toBe('regelbesteuert')
    const now = new Date('2026-10-01T10:00:00Z')
    const { issues, added } = checkTaxModes(modes, modes.slice(0, 1), now)
    expect(added).toHaveLength(1)
    expect(issues.map((i) => i.path)).toEqual([
      'tax.modes.1.reason',
      'tax.modes.1.confirmedWithTaxAdvisor',
    ])
    expect(checkTaxModes([], [], now).issues).toHaveLength(1)
  })

  it('R-060/R-202 Lieferländer und Zonen', () => {
    expect(zoneForCountry('DE')).toBe('DE')
    expect(zoneForCountry('AT')).toBe('EU')
    expect(zoneForCountry('CH')).toBe('CH')
    const rates = (['brief', 'paket_klein', 'keramik'] as const).map((shippingClass) => ({
      zone: 'DE' as const,
      shippingClass,
      priceCents: 500,
    }))
    expect(checkShipping({ enabledCountries: ['DE'], rates })).toEqual([])
    expect(checkShipping({ enabledCountries: ['DE', 'AT'], rates }).length).toBeGreaterThan(0)
    expect(checkShipping({ enabledCountries: [], rates })[0]!.message).toMatch(/Deutschland/)
  })

  it('R-201 Verpackung: Schlüssel eindeutig, genau eine Vorbelegung je Versandklasse', () => {
    const templates = [{ key: 'a', components: [{ grams: 5 }] }]
    const defaults = ['brief', 'paket_klein', 'keramik'].map((shippingClass) => ({
      shippingClass,
      templateKey: 'a',
    }))
    expect(checkPackaging({ templates, defaultsByShippingClass: defaults })).toEqual([])
    expect(
      checkPackaging({
        templates: [...templates, ...templates],
        defaultsByShippingClass: defaults,
      }),
    ).toHaveLength(1)
    expect(checkPackaging({ templates, defaultsByShippingClass: defaults.slice(1) })).toHaveLength(
      1,
    )
  })

  it('Umsatzwächter: u1 < Vorjahr < u3 < u3a < u4 < laufendes Jahr', () => {
    const ok = {
      previousYearLimitCents: 2_500_000,
      currentYearLimitCents: 10_000_000,
      stageThresholdsCents: { u1: 2_000_000, u3: 8_000_000, u3a: 9_000_000, u4: 9_500_000 },
    }
    expect(checkRevenueGuard(ok)).toEqual([])
    expect(
      checkRevenueGuard({
        ...ok,
        stageThresholdsCents: { ...ok.stageThresholdsCents, u4: 8_500_000 },
      }),
    ).toHaveLength(1)
  })
})
