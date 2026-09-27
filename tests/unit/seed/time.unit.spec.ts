import { describe, expect, it } from 'vitest'

import {
  CANONICAL_SEED_NOW,
  isSeedTimeExpr,
  parseSeedNow,
  resolveSeedTime,
  SeedTimeError,
} from '@/lib/seed/time'
import { fixedClock } from '@/lib/time'

// P1.28: Zeitausdrücke des Beispielbestands (SEED-SPEC §2.2, §2.3) bei kanonischem N.

const now = new Date(CANONICAL_SEED_NOW)
const at = (expr: string) => {
  const v = resolveSeedTime(expr, { now })
  return v instanceof Date ? v.toISOString() : v
}

describe('resolveSeedTime (AK-SEED-16)', () => {
  it.each([
    ['D-50', '2026-08-26T10:00:00.000Z'],
    ['D-41@19:12', '2026-09-04T17:12:00.000Z'],
    ['D+3@23:59:59', '2026-10-18T21:59:59.000Z'],
    ['D+13@21:18', '2026-10-28T20:18:00.000Z'],
    ['SAT>=D+56@12:00', '2026-12-12T11:00:00.000Z'],
    ['SAT>=D-50@12:00', '2026-08-29T10:00:00.000Z'],
    ['N-6min', '2026-10-15T07:54:00.000Z'],
    ['M-9', '2026-01'],
    ['M-1', '2026-09'],
  ])('AK-SEED-16: %s → %s (Tabelle §2.2)', (expr, expected) => {
    expect(at(expr)).toBe(expected)
  })

  it('AK-SEED-16: weitere Ausdrücke – N, N+30min, N+2h, D+0, Monatswechsel, Kalender §2.3', () => {
    expect(at('N')).toBe('2026-10-15T08:00:00.000Z')
    expect(at('N+30min')).toBe('2026-10-15T08:30:00.000Z')
    expect(at('N+24min')).toBe('2026-10-15T08:24:00.000Z')
    expect(at('N+2h')).toBe('2026-10-15T10:00:00.000Z')
    expect(at('D+0')).toBe('2026-10-15T10:00:00.000Z')
    expect(at('D-111@18:00')).toBe('2026-06-26T16:00:00.000Z') // Fr 26.06.
    expect(at('D+31')).toBe('2026-11-15T11:00:00.000Z') // So 15.11., Winterzeit
    expect(at('D+10@12:00')).toBe('2026-10-25T11:00:00.000Z') // Tag der Zeitumstellung
    expect(at('M-0')).toBe('2026-10')
    expect(resolveSeedTime('M-10', { now })).toBe('2025-12')
  })

  it('AK-SEED-16: SAT>= bleibt an einem Samstag auf demselben Tag', () => {
    // D-5 = Sa 10.10.
    expect(at('SAT>=D-5')).toBe(at('D-5'))
  })

  it('AK-SEED-16: unbekannte oder ungültige Ausdrücke werfen SeedTimeError', () => {
    for (const bad of ['D50', 'D-5@25:00', 'X+1', 'N+5d', 'M+1', '2026-10-15']) {
      expect(isSeedTimeExpr(bad) && !/25:00/.test(bad)).toBe(false)
      expect(() => resolveSeedTime(bad, { now })).toThrow(SeedTimeError)
    }
  })
})

describe('parseSeedNow (AK-SEED-16)', () => {
  it('AK-SEED-16: gültiges SEED_NOW mit Offset', () => {
    expect(parseSeedNow(CANONICAL_SEED_NOW, fixedClock('2030-01-01T00:00:00Z')).toISOString()).toBe(
      '2026-10-15T08:00:00.000Z',
    )
    expect(
      parseSeedNow('2026-10-15T08:00:00Z', fixedClock('2030-01-01T00:00:00Z')).toISOString(),
    ).toBe('2026-10-15T08:00:00.000Z')
  })

  it('AK-SEED-16: leer → Zeit der injizierten Uhr, auf die Minute abgerundet', () => {
    const clock = fixedClock('2026-11-02T09:17:43.512Z')
    expect(parseSeedNow('', clock).toISOString()).toBe('2026-11-02T09:17:00.000Z')
    expect(parseSeedNow(undefined, clock).toISOString()).toBe('2026-11-02T09:17:00.000Z')
  })

  it('AK-SEED-16: ohne Offset oder kein Datum → Fehler (die CLI endet mit Exit 1)', () => {
    const clock = fixedClock('2026-11-02T09:17:43Z')
    for (const bad of [
      '2026-10-15T10:00:00',
      '2026-10-15',
      'morgen',
      '2026-13-45T10:00:00+02:00',
    ]) {
      expect(() => parseSeedNow(bad, clock)).toThrow(SeedTimeError)
    }
  })
})
