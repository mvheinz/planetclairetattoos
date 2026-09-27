import { addBerlinMonths } from '@/lib/time'

// Antwortfristen für Datenschutz-Anfragen (Art. 12 Abs. 3 DSGVO, DATENMODELL §6.26, LOESCHKONZEPT §5): ein Monat ab
// Eingang, kalendergenau in Europe/Berlin (31.01. → 28./29.02.), verlängerbar um höchstens zwei weitere Monate. Die
// Frist läuft auch während der Identitätsprüfung weiter.

/** Antwort bis: `receivedAt + 1 Monat`. */
export function privacyRequestDueAt(receivedAt: Date): Date {
  return addBerlinMonths(receivedAt, 1)
}

/** Spätestmögliche verlängerte Frist: `receivedAt + 3 Monate`. */
export function privacyRequestMaxExtendedDueAt(receivedAt: Date): Date {
  return addBerlinMonths(receivedAt, 3)
}
