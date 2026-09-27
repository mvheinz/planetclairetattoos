import { describe, expect, it } from 'vitest'

import {
  LEGAL_CONSTANTS,
  ORDER_BUTTON_LABEL,
  SMALL_BUSINESS_VAT_NOTE,
  WITHDRAWAL_CONFIRM_LABEL,
  WITHDRAWAL_LINK_LABEL,
  vatNote,
} from '@/lib/legal/constants'

// P1.25: rechtlich fixierte Texte (DATENMODELL §7.2, CLAUDE.md §6).

describe('Rechtskonstanten (src/lib/legal/constants.ts)', () => {
  it('Bestell-Button exakt „Zahlungspflichtig bestellen“ / „Order with obligation to pay“ (§ 312j BGB)', () => {
    expect(ORDER_BUTTON_LABEL).toEqual({
      de: 'Zahlungspflichtig bestellen',
      en: 'Order with obligation to pay',
    })
  })

  it('R-090/R-092 „Vertrag widerrufen“ und „Widerruf bestätigen“', () => {
    expect(WITHDRAWAL_LINK_LABEL).toEqual({
      de: 'Vertrag widerrufen',
      en: 'Withdraw from contract here',
    })
    expect(WITHDRAWAL_CONFIRM_LABEL).toEqual({
      de: 'Widerruf bestätigen',
      en: 'Confirm withdrawal',
    })
  })

  it('R-032 Kleinunternehmer-Satz, bei Regelbesteuerung „inkl. {rate} % USt.“, nie „MwSt.“', () => {
    expect(SMALL_BUSINESS_VAT_NOTE.de).toBe('Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.')
    expect(vatNote('kleinunternehmer', 'de')).toBe(SMALL_BUSINESS_VAT_NOTE.de)
    expect(vatNote('kleinunternehmer', 'en')).toBe(SMALL_BUSINESS_VAT_NOTE.en)
    expect(vatNote('regelbesteuert', 'de', 19)).toBe('inkl. 19 % USt.')
    expect(vatNote('regelbesteuert', 'en', 7)).toBe('incl. 7% VAT')
    expect(vatNote('kleinunternehmer', 'de')).not.toMatch(/inkl|MwSt/)
    expect(() => vatNote('regelbesteuert', 'de', 0)).toThrow()
  })

  it('Konstanten sind unveränderlich', () => {
    expect(Object.isFrozen(ORDER_BUTTON_LABEL)).toBe(true)
    expect(Object.isFrozen(LEGAL_CONSTANTS)).toBe(true)
    expect(() => {
      ;(ORDER_BUTTON_LABEL as { de: string }).de = 'Kaufen'
    }).toThrow()
  })
})
