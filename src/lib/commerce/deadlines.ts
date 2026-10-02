import 'server-only'

import { addBerlinDays, berlinDayStart } from '@/lib/time'

// Fristen – einzige Stelle (ARCHITEKTUR §2.1, DATENMODELL §8.1/§8.5, R-071). Reine Funktionen ohne DB und ohne eigene
// Uhr: der Ausgangszeitpunkt kommt immer als Parameter (A-08). Kalenderrechnung in Europe/Berlin (`src/lib/time.ts`),
// unabhängig von der Zeitzone des Prozesses.

export interface DeadlineSettings {
  payment?: {
    reservationMinutes?: number | null
    prepaymentDays?: number | null
    prepaymentReminderHours?: number | null
  } | null
}

/** Standardwerte und erlaubte Bereiche wie im Global `settings.payment` (DATENMODELL §7.1). */
export const DEADLINE_DEFAULTS = {
  reservationMinutes: { value: 30, min: 30, max: 60 },
  prepaymentDays: { value: 5, min: 2, max: 14 },
  prepaymentReminderHours: { value: 72, min: 24, max: 335 },
} as const

/** Stripe verlangt ≥ 30 min ab eigener Erstellung – daher 1 min nach dem Countdown (DATENMODELL §8.1). */
export const STRIPE_EXPIRY_OFFSET_MINUTES = 1
/** Die Reservierung hält 5 min länger als die Stripe-Session (Puffer für späte Webhooks, DATENMODELL §8.1). */
export const RESERVATION_GRACE_MINUTES = 5

const MINUTE = 60_000
const HOUR = 60 * MINUTE

function setting(
  settings: DeadlineSettings | null | undefined,
  key: keyof typeof DEADLINE_DEFAULTS,
): number {
  const { value, min, max } = DEADLINE_DEFAULTS[key]
  const raw = settings?.payment?.[key]
  if (raw === null || raw === undefined) return value
  if (!Number.isInteger(raw) || raw < min || raw > max) {
    throw new Error(
      `settings.payment.${key} muss eine ganze Zahl von ${min} bis ${max} sein: ${raw}`,
    )
  }
  return raw
}

function assertDate(d: Date, label: string): void {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) throw new Error(`${label}: ungültige Zeit`)
}

export interface ReservationTimes {
  /** Countdown-Ende auf der Kasse: T0 + `reservationMinutes`. */
  displayExpiresAt: Date
  /** Ablauf der Stripe-Session: Countdown-Ende + 1 min, auf volle Sekunden aufgerundet (Stripe `expires_at`). */
  stripeExpiresAt: Date
  /** `checkouts.expiresAt` = `reservations.expiresAt` = `products.reserved_until`: Stripe-Ablauf + 5 min. */
  expiresAt: Date
}

/** Reservierungszeiten einer neuen Kasse (DATENMODELL §8.1); `t0` = injizierte Zeit vor dem Stripe-Aufruf. */
export function reservationTimes(
  t0: Date,
  settings: DeadlineSettings | null | undefined,
): ReservationTimes {
  assertDate(t0, 'reservationTimes')
  const minutes = setting(settings, 'reservationMinutes')
  const displayExpiresAt = new Date(t0.getTime() + minutes * MINUTE)
  const stripeMs = displayExpiresAt.getTime() + STRIPE_EXPIRY_OFFSET_MINUTES * MINUTE
  const stripeExpiresAt = new Date(Math.ceil(stripeMs / 1000) * 1000)
  const expiresAt = new Date(stripeExpiresAt.getTime() + RESERVATION_GRACE_MINUTES * MINUTE)
  return { displayExpiresAt, stripeExpiresAt, expiresAt }
}

export interface PrepaymentDeadlines {
  /** Zahlungsfrist: 23:59:59 Europe/Berlin am `prepaymentDays`-ten Kalendertag nach dem Berliner Bestelltag. */
  dueAt: Date
  /** Erinnerung fällig: `placedAt` + `prepaymentReminderHours` (absolute Stunden). */
  reminderDueAt: Date
}

/**
 * Fristen der Vorkasse (E-23, R-071, DATENMODELL §8.5). Beispiel: Bestellung Sa 26.09.2026 10:00 (Berlin) →
 * `reminderDueAt` Di 29.09.2026 10:00, `dueAt` Do 01.10.2026 23:59:59 Berlin (= 21:59:59 UTC); über den Wechsel auf
 * Winterzeit: 22.10.2026 → 27.10.2026 23:59:59 MEZ (= 22:59:59 UTC).
 */
export function prepaymentDeadlines(
  placedAt: Date,
  settings: DeadlineSettings | null | undefined,
): PrepaymentDeadlines {
  assertDate(placedAt, 'prepaymentDeadlines')
  const days = setting(settings, 'prepaymentDays')
  const hours = setting(settings, 'prepaymentReminderHours')
  // Beginn des Folgetags nach dem Fristtag (00:00 Berlin existiert an jedem Tag) minus eine Sekunde.
  const nextDayStart = addBerlinDays(berlinDayStart(placedAt), days + 1)
  const dueAt = new Date(berlinDayStart(nextDayStart).getTime() - 1000)
  const reminderDueAt = new Date(placedAt.getTime() + hours * HOUR)
  return { dueAt, reminderDueAt }
}
