import { describe, expect, it } from 'vitest'

import {
  addBerlinDays,
  berlinDayStart,
  berlinMonthKey,
  berlinMonthRange,
  berlinYear,
  fixedClock,
  formatBerlin,
} from '@/lib/time'

describe('time (ARCHITEKTUR §3.9)', () => {
  it('berlinYear: Silvester 23:30 UTC ist in Berlin schon 2027', () => {
    expect(berlinYear(new Date('2026-12-31T23:30:00Z'))).toBe(2027)
    expect(berlinYear(new Date('2026-12-31T22:30:00Z'))).toBe(2026)
  })

  it('berlinMonthKey rechnet in Berliner Zeit', () => {
    expect(berlinMonthKey(new Date('2026-10-31T23:30:00Z'))).toBe('2026-11')
  })

  it('berlinDayStart am Tag der Zeitumstellung (25.10.2026)', () => {
    // 25.10.2026 00:00 Berlin = 24.10. 22:00 UTC (noch Sommerzeit, UTC+2)
    expect(berlinDayStart(new Date('2026-10-25T12:00:00Z')).toISOString()).toBe(
      '2026-10-24T22:00:00.000Z',
    )
    // 26.10.2026 00:00 Berlin = 25.10. 23:00 UTC (Winterzeit, UTC+1)
    expect(berlinDayStart(new Date('2026-10-26T12:00:00Z')).toISOString()).toBe(
      '2026-10-25T23:00:00.000Z',
    )
  })

  it('addBerlinDays über die Zeitumstellung behält die lokale Uhrzeit', () => {
    // 24.10.2026 10:00 Berlin (UTC+2) + 1 Tag = 25.10.2026 10:00 Berlin (UTC+1) = 09:00 UTC
    const d = addBerlinDays(new Date('2026-10-24T08:00:00Z'), 1)
    expect(d.toISOString()).toBe('2026-10-25T09:00:00.000Z')
    expect(formatBerlin(d, 'dd.MM.yyyy HH:mm')).toBe('25.10.2026 10:00')
  })

  it('berlinMonthRange liefert [Start, Ende) in Berliner Zeit', () => {
    const { start, end } = berlinMonthRange('2026-10')
    expect(start.toISOString()).toBe('2026-09-30T22:00:00.000Z')
    expect(end.toISOString()).toBe('2026-10-31T23:00:00.000Z')
    expect(() => berlinMonthRange('2026-13')).toThrow()
  })

  it('fixedClock liefert immer denselben Zeitpunkt, ungültig wirft', () => {
    const c = fixedClock('2026-10-15T10:00:00+02:00')
    expect(c.now().toISOString()).toBe('2026-10-15T08:00:00.000Z')
    expect(() => fixedClock('kein Datum')).toThrow()
  })

  it('formatBerlin EN', () => {
    expect(formatBerlin(new Date('2026-10-15T08:00:00Z'), 'd MMMM yyyy', 'en')).toBe(
      '15 October 2026',
    )
  })
})
