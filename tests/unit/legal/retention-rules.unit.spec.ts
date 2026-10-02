import { describe, expect, it } from 'vitest'

import {
  eventCutoff,
  isDue,
  L_03_CHECKOUTS,
  L_04_CANCELLED_PREPAYMENT_STAGE_1,
  L_05_ORDERS_STAGE_B,
  L_05_ORDERS_STAGE_C,
  L_05_ORDERS_STAGE_D,
  L_06_INVOICES,
  L_08_WITHDRAWALS,
  L_10_INQUIRIES,
  L_13A_RATE_LIMIT,
  RETENTION_RULES,
  retainUntil,
} from '@/lib/retention/policy'

// P6.14 – Fristfunktionen (LOESCHKONZEPT §1 Nr. 3, §2; DATENMODELL §12): Kalenderjahresende Europe/Berlin, „ab Ereignis“
// kalendergenau, Monatsenden, Sommerzeit; Vorfilter `eventCutoff` deckt jede fällige Frist ab.

const d = (s: string) => new Date(s)

describe('Fristen ab Ende des Kalenderjahres (Europe/Berlin)', () => {
  it('Silvester 23:59 Berlin = 22:59 UTC gehört noch zum alten Jahr', () => {
    // 31.12.2026 23:59 Berlin → Ende 2026 + 6 Jahre = 01.01.2033 00:00 Berlin = 31.12.2032 23:00 UTC
    expect(retainUntil(L_05_ORDERS_STAGE_D, d('2026-12-31T22:59:00.000Z')).toISOString()).toBe(
      '2032-12-31T23:00:00.000Z',
    )
    // 01.01.2027 00:30 Berlin (= 31.12.2026 23:30 UTC) gehört schon zu 2027
    expect(retainUntil(L_05_ORDERS_STAGE_D, d('2026-12-31T23:30:00.000Z')).toISOString()).toBe(
      '2033-12-31T23:00:00.000Z',
    )
  })

  it('L-06 Belege 10 bzw. 8 Jahre ab Ende des Ausstellungsjahres; L-08 Widerrufe 6 Jahre', () => {
    expect(retainUntil(L_06_INVOICES(10), d('2026-10-14T10:00:00.000Z')).toISOString()).toBe(
      '2036-12-31T23:00:00.000Z',
    )
    expect(retainUntil(L_06_INVOICES(8), d('2026-10-14T10:00:00.000Z')).toISOString()).toBe(
      '2034-12-31T23:00:00.000Z',
    )
    expect(retainUntil(L_08_WITHDRAWALS, d('2026-06-01T10:00:00.000Z')).toISOString()).toBe(
      '2032-12-31T23:00:00.000Z',
    )
  })
})

describe('Fristen ab Ereignis (kalendergenau, Berlin)', () => {
  it('Monatsende: 31.08. + 6 Monate = 28.02.; 15.10. + 6 Monate = 15.04.', () => {
    expect(retainUntil(L_10_INQUIRIES, d('2026-08-31T08:00:00.000Z')).toISOString()).toBe(
      '2027-02-28T09:00:00.000Z', // 10:00 Berlin bleibt 10:00 Berlin (Winterzeit)
    )
    expect(retainUntil(L_10_INQUIRIES, d('2026-10-15T08:00:00.000Z')).toISOString()).toBe(
      '2027-04-15T08:00:00.000Z',
    )
  })

  it('Sommerzeit: Tage halten die Berliner Uhrzeit, Stunden sind absolut', () => {
    // 10.03.2027 12:00 Berlin (MEZ) + 30 Tage = 09.04.2027 12:00 Berlin (MESZ)
    expect(retainUntil(L_03_CHECKOUTS, d('2027-03-10T11:00:00.000Z')).toISOString()).toBe(
      '2027-04-09T10:00:00.000Z',
    )
    expect(retainUntil(L_13A_RATE_LIMIT, d('2027-03-27T12:00:00.000Z')).toISOString()).toBe(
      '2027-03-28T12:00:00.000Z',
    )
  })

  it('L-05 Stufe C 12 Monate, Stufe B 180 Tage, L-04 Stufe 1 30 Tage', () => {
    expect(retainUntil(L_05_ORDERS_STAGE_C, d('2026-10-14T10:00:00.000Z')).toISOString()).toBe(
      '2027-10-14T10:00:00.000Z',
    )
    expect(retainUntil(L_05_ORDERS_STAGE_B, d('2026-10-14T10:00:00.000Z')).toISOString()).toBe(
      '2027-04-12T10:00:00.000Z',
    )
    expect(
      retainUntil(L_04_CANCELLED_PREPAYMENT_STAGE_1, d('2026-10-14T10:00:00.000Z')).toISOString(),
    ).toBe('2026-11-13T11:00:00.000Z')
  })
})

describe('isDue und eventCutoff (Vorfilter der Löschjobs)', () => {
  it('Tag vorher nicht fällig, Tag danach fällig', () => {
    const event = d('2026-10-14T10:00:00.000Z')
    const due = retainUntil(L_03_CHECKOUTS, event)
    expect(isDue(L_03_CHECKOUTS, event, new Date(due.getTime() - 86_400_000))).toBe(false)
    expect(isDue(L_03_CHECKOUTS, event, due)).toBe(true)
    expect(isDue(L_03_CHECKOUTS, event, new Date(due.getTime() + 86_400_000))).toBe(true)
  })

  it('jede fällige Frist liegt vor dem Vorfilter (alle Regeln, über Monatsenden und Zeitumstellung)', () => {
    const events = [
      '2026-01-31T10:00:00.000Z',
      '2026-03-29T00:30:00.000Z',
      '2026-08-31T22:30:00.000Z',
      '2026-10-25T01:30:00.000Z',
      '2026-12-31T22:59:00.000Z',
      '2026-12-31T23:30:00.000Z',
    ].map(d)
    for (const rule of RETENTION_RULES) {
      for (const event of events) {
        const due = retainUntil(rule, event)
        for (const offset of [0, 3_600_000, 86_400_000]) {
          const until = new Date(due.getTime() + offset)
          expect(event.getTime(), `${rule.id} ${event.toISOString()}`).toBeLessThanOrEqual(
            eventCutoff(rule, until).getTime(),
          )
        }
      }
    }
  })
})
