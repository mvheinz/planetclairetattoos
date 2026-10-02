import { describe, expect, it } from 'vitest'

import { PRICE_CENTS_RANGE, parseEuroInput } from '@/lib/money'

// P5.6 – Preis-Eingabe im Formular „Neues Stück“ (KONZEPT §7.4): Euro → Integer-Cent, Grenzen 1,00–10.000,00 €.

describe('parseEuroInput (P5.6)', () => {
  it('„45“ → 4500, „45,50“ → 4550 (Preis-Grenzen)', () => {
    expect(parseEuroInput('45', PRICE_CENTS_RANGE)).toBe(4500)
    expect(parseEuroInput('45,50', PRICE_CENTS_RANGE)).toBe(4550)
    expect(parseEuroInput('45,5', PRICE_CENTS_RANGE)).toBe(4550)
    expect(parseEuroInput('1,00', PRICE_CENTS_RANGE)).toBe(100)
    expect(parseEuroInput('10.000', PRICE_CENTS_RANGE)).toBe(1_000_000)
    expect(parseEuroInput('10.000,00', PRICE_CENTS_RANGE)).toBe(1_000_000)
  })

  it('„0,99“ und „10.000,01“ werden als Preis abgelehnt', () => {
    expect(parseEuroInput('0,99', PRICE_CENTS_RANGE)).toBeNull()
    expect(parseEuroInput('10.000,01', PRICE_CENTS_RANGE)).toBeNull()
    expect(parseEuroInput('0', PRICE_CENTS_RANGE)).toBeNull()
  })

  it('ohne Grenzen bleibt das Verhalten gleich (Beträge wie 0,99 € für Erstattungen)', () => {
    expect(parseEuroInput('0,99')).toBe(99)
    expect(parseEuroInput('10.000,01')).toBe(1_000_001)
    expect(parseEuroInput('45,555')).toBeNull()
  })
})
