import { berlinMonthKey, berlinMonthRange, formatBerlin } from '@/lib/time'

// Schalter „Anfragen offen / ausgebucht bis …“ (V-64, U-93; DATENMODELL §7.1 `settings.tattoo.inquiriesOpen`,
// `bookedUntil`, `bookedNote`): reine Logik ohne Datenbank, auch in Verwaltung und Tests nutzbar. Ist der Schalter aus,
// zeigen die Tattoo-Seiten (R11–R18) und die Auftragsarbeiten (R10) einen ruhigen Hinweis; der Mail-Knopf der
// Tattoo-Anfrage weicht dem Hinweis. Mit Monat endet der Hinweis von selbst, sobald dieser Monat in Berlin vorbei ist
// (`bookedUntil` = einschließlich). Keine Warteliste (E-Liste „Später“).

/** Monat `JJJJ-MM` (Monat 01–12). */
export const BOOKED_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/
/** Höchstlänge des kurzen Hinweises je Sprache. */
export const BOOKED_NOTE_MAX = 160

export interface BookingSettings {
  /** `false` = ausgebucht (Standard: offen). */
  inquiriesOpen: boolean
  /** Letzter ausgebuchter Monat `JJJJ-MM` (einschließlich) oder `null` = bis der Schalter wieder an ist. */
  bookedUntil: string | null
  /** Eigener kurzer Hinweis in der Sprache der Seite (sonst Standardsatz). */
  note: string | null
}

export interface ActiveBooking {
  /** Letzter ausgebuchter Monat oder `null`. */
  until: string | null
  /** Erster Monat mit neuen Anfragen (Monat nach `until`) oder `null`. */
  resumesFrom: string | null
  note: string | null
}

export const OPEN_BOOKING: BookingSettings = { inquiriesOpen: true, bookedUntil: null, note: null }

type Obj = Record<string, unknown>

/** Auswahl aus `settings.tattoo` (öffentliche Whitelist; ungültige Werte gelten als nicht gesetzt). */
export function pickBooking(tattoo: Obj | null | undefined): BookingSettings {
  const t = tattoo ?? {}
  const until = typeof t.bookedUntil === 'string' ? t.bookedUntil.trim() : ''
  const note = typeof t.bookedNote === 'string' ? t.bookedNote.trim() : ''
  return {
    // Nur ein ausdrückliches `false` schließt (fehlende Spalte, alte Daten = offen).
    inquiriesOpen: t.inquiriesOpen !== false,
    bookedUntil: BOOKED_MONTH_RE.test(until) ? until : null,
    note: note ? note.slice(0, BOOKED_NOTE_MAX) : null,
  }
}

/** Monat nach `JJJJ-MM`. */
export function nextMonthKey(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number]
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

/** Ist der Monat `JJJJ-MM` in Berlin schon vorbei (der aktuelle Monat zählt noch)? */
export function monthHasPassed(month: string, now: Date): boolean {
  return month < berlinMonthKey(now)
}

/**
 * Wirksamer Zustand zum Zeitpunkt `now`: `null` = Anfragen offen (Schalter an oder Monat vorbei), sonst der Hinweis.
 */
export function activeBooking(booking: BookingSettings, now: Date): ActiveBooking | null {
  if (booking.inquiriesOpen) return null
  if (booking.bookedUntil && monthHasPassed(booking.bookedUntil, now)) return null
  return {
    until: booking.bookedUntil,
    resumesFrom: booking.bookedUntil ? nextMonthKey(booking.bookedUntil) : null,
    note: booking.note,
  }
}

/** „März 2027“ / „March 2027“ (Monatsname in Berliner Zeit). */
export function formatBookingMonth(month: string, locale: 'de' | 'en'): string {
  return formatBerlin(berlinMonthRange(month).start, 'LLLL yyyy', locale)
}
