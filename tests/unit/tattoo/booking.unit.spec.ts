import { describe, expect, it } from 'vitest'

import {
  activeBooking,
  BOOKED_NOTE_MAX,
  formatBookingMonth,
  monthHasPassed,
  nextMonthKey,
  OPEN_BOOKING,
  pickBooking,
} from '@/lib/tattoo/booking'

// P20.5 (V-64, U-93): Schalter „Anfragen offen / ausgebucht bis …“ – Datumslogik in Berliner Zeit. „Ausgebucht bis“ ist
// einschließlich: Der Hinweis gilt bis zum Ende dieses Monats (Europe/Berlin) und verschwindet danach von selbst.

const closed = (bookedUntil: string | null, note: string | null = null) => ({
  inquiriesOpen: false,
  bookedUntil,
  note,
})

describe('pickBooking', () => {
  it('Standard offen; nur ein ausdrückliches false schließt', () => {
    expect(pickBooking(undefined)).toEqual(OPEN_BOOKING)
    expect(pickBooking({})).toEqual(OPEN_BOOKING)
    expect(pickBooking({ inquiriesOpen: null }).inquiriesOpen).toBe(true)
    expect(pickBooking({ inquiriesOpen: true }).inquiriesOpen).toBe(true)
    expect(pickBooking({ inquiriesOpen: false }).inquiriesOpen).toBe(false)
  })

  it('ungültiger Monat gilt als nicht gesetzt; Hinweis getrimmt und gekürzt', () => {
    for (const v of ['2027-13', '2027-3', '27-03', 'März', '', null, 202703]) {
      expect(pickBooking({ inquiriesOpen: false, bookedUntil: v }).bookedUntil, String(v)).toBe(
        null,
      )
    }
    expect(pickBooking({ bookedUntil: ' 2027-03 ' }).bookedUntil).toBe('2027-03')
    expect(pickBooking({ bookedNote: '  Gerade voll  ' }).note).toBe('Gerade voll')
    expect(pickBooking({ bookedNote: '   ' }).note).toBe(null)
    expect(pickBooking({ bookedNote: 'x'.repeat(300) }).note).toHaveLength(BOOKED_NOTE_MAX)
  })
})

describe('activeBooking (Europe/Berlin)', () => {
  const now = new Date('2026-10-12T10:00:00Z')

  it('Schalter an → kein Hinweis, auch mit Monat', () => {
    expect(activeBooking({ inquiriesOpen: true, bookedUntil: '2027-03', note: null }, now)).toBe(
      null,
    )
  })

  it('aus ohne Monat → Hinweis ohne Ende', () => {
    expect(activeBooking(closed(null), now)).toEqual({ until: null, resumesFrom: null, note: null })
  })

  it('aus mit kommendem Monat → Hinweis mit Monat danach; eigener Hinweis bleibt', () => {
    expect(activeBooking(closed('2027-02', 'Neue Anfragen ab März'), now)).toEqual({
      until: '2027-02',
      resumesFrom: '2027-03',
      note: 'Neue Anfragen ab März',
    })
  })

  it('der eingetragene Monat zählt noch; danach verschwindet der Hinweis von selbst', () => {
    expect(activeBooking(closed('2026-10'), now)?.resumesFrom).toBe('2026-11')
    expect(activeBooking(closed('2026-09'), now)).toBe(null)
    expect(activeBooking(closed('2025-12'), now)).toBe(null)
  })

  it('Monatswechsel nach Berliner Uhr, nicht nach UTC (Winter- und Sommerzeit)', () => {
    // 28.02.2027 23:59 Berlin (MEZ, UTC+1) = 22:59 UTC → Februar läuft noch
    expect(activeBooking(closed('2027-02'), new Date('2027-02-28T22:59:00Z'))).not.toBe(null)
    // 01.03.2027 00:30 Berlin = 28.02. 23:30 UTC → Februar vorbei
    expect(activeBooking(closed('2027-02'), new Date('2027-02-28T23:30:00Z'))).toBe(null)
    // 31.07.2027 23:59 Berlin (MESZ, UTC+2) = 21:59 UTC → Juli läuft noch; 22:30 UTC = 01.08. 00:30 → vorbei
    expect(activeBooking(closed('2027-07'), new Date('2027-07-31T21:59:00Z'))).not.toBe(null)
    expect(activeBooking(closed('2027-07'), new Date('2027-07-31T22:30:00Z'))).toBe(null)
  })

  it('monthHasPassed und nextMonthKey (Jahreswechsel)', () => {
    expect(monthHasPassed('2026-09', now)).toBe(true)
    expect(monthHasPassed('2026-10', now)).toBe(false)
    expect(monthHasPassed('2026-11', now)).toBe(false)
    expect(nextMonthKey('2026-12')).toBe('2027-01')
    expect(nextMonthKey('2027-01')).toBe('2027-02')
    expect(nextMonthKey('2027-09')).toBe('2027-10')
  })

  it('Monatsname DE/EN', () => {
    expect(formatBookingMonth('2027-03', 'de')).toBe('März 2027')
    expect(formatBookingMonth('2027-03', 'en')).toBe('March 2027')
    expect(formatBookingMonth('2027-01', 'de')).toBe('Januar 2027')
  })
})
