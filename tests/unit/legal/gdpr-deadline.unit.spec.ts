import { describe, expect, it } from 'vitest'

import {
  privacyReminderDue,
  privacyRequestDueAt,
  privacyRequestMaxExtendedDueAt,
  privacyRequestTarget,
} from '@/lib/privacy/deadlines'
import { addBerlinDays, berlinDateKey, parseBerlinLocal } from '@/lib/time'

// P6.16 – Fristen der Datenschutz-Anfragen (Art. 12 Abs. 3 DSGVO, DATENMODELL §6.26, LOESCHKONZEPT §5.3, R-153):
// `dueAt` = Eingang + 1 Monat kalendergenau in Europe/Berlin (Monatsende), Verlängerung höchstens bis Eingang + 3 Monate,
// Erinnerungen genau 7 Tage und 1 Tag vor `extendedDueAt ?? dueAt`.

const at = (day: string, time = '12:00') => parseBerlinLocal(`${day}T${time}`)!
const key = (d: Date) => berlinDateKey(d)

describe('DM-PRQ-01 Frist = Eingang + 1 Monat (Berlin, kalendergenau)', () => {
  it.each([
    ['2026-10-15', '2026-11-15'],
    ['2027-01-31', '2027-02-28'],
    ['2028-01-31', '2028-02-29'],
    ['2026-03-31', '2026-04-30'],
    ['2026-08-31', '2026-09-30'],
    ['2026-12-31', '2027-01-31'],
  ])('DM-PRQ-01 Eingang %s → Antwort bis %s', (received, due) => {
    expect(key(privacyRequestDueAt(at(received)))).toBe(due)
  })

  it('DM-PRQ-01 auch kurz nach Mitternacht Berlin (UTC liegt am Vortag) und über die Zeitumstellung', () => {
    expect(key(privacyRequestDueAt(at('2026-03-01', '00:30')))).toBe('2026-04-01')
    expect(key(privacyRequestDueAt(at('2026-10-01', '00:15')))).toBe('2026-11-01')
  })

  it('DM-PRQ-01 Verlängerung höchstens bis Eingang + 3 Monate (31.01. → 30.04.)', () => {
    expect(key(privacyRequestMaxExtendedDueAt(at('2026-01-31')))).toBe('2026-04-30')
    expect(key(privacyRequestMaxExtendedDueAt(at('2026-11-30')))).toBe('2027-02-28')
  })
})

describe('R-153 Erinnerungen genau an Tag −7 und −1', () => {
  const due = at('2026-11-15')

  it('R-153 Tag −7 → 7d, Tag −1 → 1d, alle anderen Tage nichts', () => {
    const stages: Record<string, string> = {}
    for (let n = -40; n <= 5; n++) {
      const now = addBerlinDays(at('2026-11-15', '08:05'), n)
      const s = privacyReminderDue(now, due, {})
      if (s) stages[String(n)] = s
    }
    expect(stages).toEqual({ '-7': '7d', '-1': '1d' })
  })

  it('R-153 schon verschickt (gleicher Tag) → nicht noch einmal', () => {
    const day7 = at('2026-11-08', '09:00')
    expect(privacyReminderDue(day7, due, { '7d': at('2026-11-08', '08:01').toISOString() })).toBe(
      null,
    )
    const day1 = at('2026-11-14', '23:30')
    expect(privacyReminderDue(day1, due, { '1d': at('2026-11-14', '08:00').toISOString() })).toBe(
      null,
    )
  })

  it('R-153 verlängerte Frist verschiebt beide Erinnerungen; die alte Stufe zählt nicht für die neue Frist', () => {
    const r = { dueAt: due.toISOString(), extendedDueAt: at('2027-01-15').toISOString() }
    const target = privacyRequestTarget(r)
    expect(key(target)).toBe('2027-01-15')
    const sentForOld = { '7d': at('2026-11-08', '08:00').toISOString() }
    expect(privacyReminderDue(at('2026-11-08', '09:00'), target, sentForOld)).toBe(null)
    expect(privacyReminderDue(at('2026-11-14', '09:00'), target, sentForOld)).toBe(null)
    expect(privacyReminderDue(at('2027-01-08', '08:00'), target, sentForOld)).toBe('7d')
    expect(privacyReminderDue(at('2027-01-14', '08:00'), target, sentForOld)).toBe('1d')
  })

  it('R-153 Monatsende: Eingang 31.01.2027 → Frist 28.02., Erinnerungen 21.02. und 27.02.', () => {
    const target = privacyRequestDueAt(at('2027-01-31'))
    expect(privacyReminderDue(at('2027-02-21', '08:00'), target, {})).toBe('7d')
    expect(privacyReminderDue(at('2027-02-27', '08:00'), target, {})).toBe('1d')
    expect(privacyReminderDue(at('2027-02-28', '08:00'), target, {})).toBe(null)
  })
})
