import { describe, expect, it } from 'vitest'

import { DEADLINE_DEFAULTS, prepaymentDeadlines, reservationTimes } from '@/lib/commerce/deadlines'
import { formatBerlin } from '@/lib/time'

// AK-8-02, DM-ORD-06 (Zeiten), R-071, DATENMODELL §8.1/§8.5 (P4.2): Fristen – einzige Stelle. Die Ergebnisse hängen
// nicht von der Zeitzone des Prozesses ab (CI läuft zusätzlich mit TZ=Europe/Berlin).

const defaults = {
  payment: {
    reservationMinutes: 30,
    prepaymentDays: 5,
    prepaymentReminderHours: 72,
  },
}
const berlin = (d: Date) => formatBerlin(d, 'EEEEEE dd.MM.yyyy HH:mm:ss')

describe('prepaymentDeadlines (R-071, DATENMODELL §8.5)', () => {
  // Wochentage nach dem Kalender: der 26.09.2026 ist ein Samstag (die Docs nannten bis P4.2 „Fr … Mo … Mi“).
  it('AK-8-02 DM-ORD-06 Bestellung Sa 26.09.2026 10:00 Berlin → Erinnerung Di 29.09. 10:00, Frist Do 01.10. 23:59:59', () => {
    const placedAt = new Date('2026-09-26T08:00:00.000Z') // Sa 10:00 MESZ
    const { dueAt, reminderDueAt } = prepaymentDeadlines(placedAt, defaults)
    expect(reminderDueAt.toISOString()).toBe('2026-09-29T08:00:00.000Z')
    expect(berlin(reminderDueAt)).toBe('Di 29.09.2026 10:00:00')
    expect(dueAt.toISOString()).toBe('2026-10-01T21:59:59.000Z')
    expect(berlin(dueAt)).toBe('Do 01.10.2026 23:59:59')
  })

  it('R-071 Bestellung 12.10. 10:00 → Frist 17.10. 23:59:59 (Berlin)', () => {
    const { dueAt, reminderDueAt } = prepaymentDeadlines(
      new Date('2026-10-12T08:00:00.000Z'),
      defaults,
    )
    expect(dueAt.toISOString()).toBe('2026-10-17T21:59:59.000Z')
    expect(berlin(dueAt)).toBe('Sa 17.10.2026 23:59:59')
    expect(reminderDueAt.toISOString()).toBe('2026-10-15T08:00:00.000Z')
  })

  it('R-071 über den Wechsel auf Winterzeit: 22.10. → 27.10. 23:59:59 MEZ (22:59:59 UTC)', () => {
    const placedAt = new Date('2026-10-22T08:00:00.000Z') // Do 10:00 MESZ
    const { dueAt, reminderDueAt } = prepaymentDeadlines(placedAt, defaults)
    expect(dueAt.toISOString()).toBe('2026-10-27T22:59:59.000Z')
    expect(berlin(dueAt)).toBe('Di 27.10.2026 23:59:59')
    // 72 echte Stunden: über die Umstellung am 25.10. zeigt die Berliner Uhr 09:00.
    expect(reminderDueAt.toISOString()).toBe('2026-10-25T08:00:00.000Z')
    expect(berlin(reminderDueAt)).toBe('So 25.10.2026 09:00:00')
  })

  it('R-071 der Berliner Bestelltag zählt, nicht der UTC-Tag (kurz vor/nach Mitternacht)', () => {
    // 26.09. 23:30 Berlin = 21:30 UTC am selben Tag; 27.09. 00:30 Berlin = 26.09. 22:30 UTC
    expect(
      prepaymentDeadlines(new Date('2026-09-26T21:30:00.000Z'), defaults).dueAt.toISOString(),
    ).toBe('2026-10-01T21:59:59.000Z')
    expect(
      prepaymentDeadlines(new Date('2026-09-26T22:30:00.000Z'), defaults).dueAt.toISOString(),
    ).toBe('2026-10-02T21:59:59.000Z')
  })

  it('R-071 über den Wechsel auf Sommerzeit (29.03.2026)', () => {
    const { dueAt } = prepaymentDeadlines(new Date('2026-03-26T09:00:00.000Z'), defaults)
    expect(dueAt.toISOString()).toBe('2026-03-31T21:59:59.000Z')
    expect(berlin(dueAt)).toBe('Di 31.03.2026 23:59:59')
  })

  it('R-071 Einstellungen prepaymentDays/prepaymentReminderHours wirken; ohne Werte gelten 5 Tage/72 h', () => {
    const placedAt = new Date('2026-09-26T08:00:00.000Z')
    const custom = prepaymentDeadlines(placedAt, {
      payment: { prepaymentDays: 7, prepaymentReminderHours: 48 },
    })
    expect(berlin(custom.dueAt)).toBe('Sa 03.10.2026 23:59:59')
    expect(berlin(custom.reminderDueAt)).toBe('Mo 28.09.2026 10:00:00')
    expect(prepaymentDeadlines(placedAt, {})).toEqual(prepaymentDeadlines(placedAt, defaults))
    expect(prepaymentDeadlines(placedAt, null)).toEqual(prepaymentDeadlines(placedAt, defaults))
    expect(DEADLINE_DEFAULTS.prepaymentDays.value).toBe(5)
  })

  it('ungültige Einstellungen oder Zeiten werfen statt still falsch zu rechnen', () => {
    const placedAt = new Date('2026-09-26T08:00:00.000Z')
    expect(() => prepaymentDeadlines(placedAt, { payment: { prepaymentDays: 1 } })).toThrow()
    expect(() => prepaymentDeadlines(placedAt, { payment: { prepaymentDays: 2.5 } })).toThrow()
    expect(() => prepaymentDeadlines(new Date('x'), defaults)).toThrow()
  })
})

describe('reservationTimes (DATENMODELL §8.1)', () => {
  it('T0 = 10:00:00 → displayExpiresAt 10:30, Stripe-Ablauf 10:31, expiresAt 10:36', () => {
    const t0 = new Date('2026-10-15T08:00:00.000Z') // 10:00 Berlin
    const r = reservationTimes(t0, defaults)
    expect(berlin(r.displayExpiresAt)).toBe('Do 15.10.2026 10:30:00')
    expect(berlin(r.stripeExpiresAt)).toBe('Do 15.10.2026 10:31:00')
    expect(berlin(r.expiresAt)).toBe('Do 15.10.2026 10:36:00')
    expect(r.displayExpiresAt.toISOString()).toBe('2026-10-15T08:30:00.000Z')
    expect(r.stripeExpiresAt.toISOString()).toBe('2026-10-15T08:31:00.000Z')
    expect(r.expiresAt.toISOString()).toBe('2026-10-15T08:36:00.000Z')
  })

  it('Stripe-Ablauf auf volle Sekunden aufgerundet (Stripe `expires_at` in Sekunden), nie unter 30 min', () => {
    const t0 = new Date('2026-10-15T08:00:00.250Z')
    const r = reservationTimes(t0, {})
    expect(r.displayExpiresAt.toISOString()).toBe('2026-10-15T08:30:00.250Z')
    expect(r.stripeExpiresAt.toISOString()).toBe('2026-10-15T08:31:01.000Z')
    expect(r.expiresAt.toISOString()).toBe('2026-10-15T08:36:01.000Z')
    expect(r.stripeExpiresAt.getTime() - t0.getTime()).toBeGreaterThanOrEqual(30 * 60_000)
  })

  it('reservationMinutes aus den Einstellungen (30–60)', () => {
    const t0 = new Date('2026-10-15T08:00:00.000Z')
    const r = reservationTimes(t0, { payment: { reservationMinutes: 45 } })
    expect(r.displayExpiresAt.toISOString()).toBe('2026-10-15T08:45:00.000Z')
    expect(r.expiresAt.toISOString()).toBe('2026-10-15T08:51:00.000Z')
    expect(() => reservationTimes(t0, { payment: { reservationMinutes: 20 } })).toThrow()
  })
})
