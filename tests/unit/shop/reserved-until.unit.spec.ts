import { describe, expect, it } from 'vitest'

import { strayRefundIdempotencyKey, strayRefundOpen } from '@/lib/commerce/strayPaymentRules'
import { reservedUntilParts } from '@/lib/shop/reservedUntil'

// P14.9 (U-58 b) – „reserviert bis 14:30“ im Korb (Europe/Berlin, nur Uhrzeit, an anderen Tagen mit Datum) und die
// Regeln des Knopfs „Erstatten“ für Zahlungen ohne Bestellung (U-58 a).

const NOW = new Date('2026-10-09T10:00:00Z') // 12:00 in Berlin (MESZ)

describe('reservedUntilParts (U-58 b)', () => {
  it('selber Tag: nur Uhrzeit in Berliner Zeit', () => {
    expect(reservedUntilParts('2026-10-09T12:30:00Z', NOW, 'de')).toEqual({
      time: '14:30',
      date: null,
    })
  })

  it('anderer Tag (Vorkasse): Datum und Uhrzeit, EN mit Monatskürzel', () => {
    expect(reservedUntilParts('2026-10-13T21:59:00Z', NOW, 'de')).toEqual({
      time: '23:59',
      date: '13.10.',
    })
    expect(reservedUntilParts('2026-10-13T21:59:00Z', NOW, 'en')).toEqual({
      time: '23:59',
      date: '13 Oct',
    })
  })

  it('Berliner Tagesgrenze zählt, nicht UTC', () => {
    // 22:30 UTC = 00:30 Berlin am Folgetag
    expect(reservedUntilParts('2026-10-09T22:30:00Z', NOW, 'de')?.date).toBe('10.10.')
  })

  it('vorbei, leer oder ungültig → null', () => {
    expect(reservedUntilParts('2026-10-09T09:00:00Z', NOW, 'de')).toBeNull()
    expect(reservedUntilParts(null, NOW, 'de')).toBeNull()
    expect(reservedUntilParts('kaputt', NOW, 'de')).toBeNull()
  })
})

describe('Erstatten-Regeln (U-58 a)', () => {
  it('offen nur bei „noch nicht“ und „fehlgeschlagen“; Schlüssel je Zahlung und Versuch', () => {
    expect(strayRefundOpen('none')).toBe(true)
    expect(strayRefundOpen(undefined)).toBe(true)
    expect(strayRefundOpen('failed')).toBe(true)
    expect(strayRefundOpen('pending')).toBe(false)
    expect(strayRefundOpen('succeeded')).toBe(false)
    expect(strayRefundIdempotencyKey('pi_123', 2)).toBe('stray-refund:pi_123:2')
  })
})
