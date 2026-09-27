import { describe, expect, it } from 'vitest'

import { assertCents, formatMoney, parseEuroInput } from '@/lib/money'

const nbsp = (s: string) => s.replace(/ /g, ' ')

describe('money (DESIGN §4.4, ARCHITEKTUR §15.4)', () => {
  it('formatMoney tag: ganze Euro ohne Nachkommastellen', () => {
    expect(nbsp(formatMoney(4500, 'de', { style: 'tag' }))).toBe('45 €')
    expect(formatMoney(4500, 'en', { style: 'tag' })).toBe('€45')
    expect(nbsp(formatMoney(3850, 'de', { style: 'tag' }))).toBe('38,50 €')
  })

  it('formatMoney full: immer zwei Nachkommastellen', () => {
    expect(formatMoney(3850, 'en')).toBe('€38.50')
    expect(nbsp(formatMoney(3850, 'de'))).toBe('38,50 €')
    expect(nbsp(formatMoney(4500, 'de'))).toBe('45,00 €')
    expect(nbsp(formatMoney(123456, 'de'))).toBe('1.234,56 €')
    expect(formatMoney(5, 'en')).toBe('€0.05')
  })

  it('parseEuroInput akzeptiert gültige Eingaben', () => {
    expect(parseEuroInput('38,50')).toBe(3850)
    expect(parseEuroInput('38,5')).toBe(3850)
    expect(parseEuroInput('38')).toBe(3800)
    expect(parseEuroInput('38.50')).toBe(3850)
    expect(parseEuroInput('1.234,50')).toBe(123450)
    expect(parseEuroInput(' 45 € ')).toBe(4500)
  })

  it('parseEuroInput lehnt 38,555, -1 und abc ab', () => {
    expect(parseEuroInput('38,555')).toBeNull()
    expect(parseEuroInput('-1')).toBeNull()
    expect(parseEuroInput('abc')).toBeNull()
    expect(parseEuroInput('')).toBeNull()
  })

  it('assertCents verlangt Ganzzahl ≥ 0', () => {
    expect(() => assertCents(3850)).not.toThrow()
    expect(() => assertCents(38.5)).toThrow()
    expect(() => assertCents(-1)).toThrow()
    expect(() => formatMoney(1.5, 'de')).toThrow()
  })
})
