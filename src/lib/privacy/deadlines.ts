import { addBerlinDays, addBerlinMonths, berlinDateKey } from '@/lib/time'

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

// --- Erinnerungen (Task `privacyRequestsDeadlineReminder`, A14, R-153, DM-PRQ-02) -------------------------------

/** Erinnerungsstufen: genau 7 Tage und 1 Tag (Berliner Kalendertage) vor der maßgeblichen Frist. */
export const PRIVACY_REMINDER_STAGES = [
  { key: '7d', days: 7 },
  { key: '1d', days: 1 },
] as const
export type PrivacyReminderStage = (typeof PRIVACY_REMINDER_STAGES)[number]['key']

/** Offene Status (Frist läuft, auch während der Identitätsprüfung). */
export const OPEN_PRIVACY_REQUEST_STATUSES = ['received', 'identity_check', 'in_progress'] as const

/** Maßgebliche Frist: `extendedDueAt ?? dueAt`. */
export function privacyRequestTarget(r: {
  dueAt: string | Date
  extendedDueAt?: string | Date | null
}): Date {
  return new Date(r.extendedDueAt ?? r.dueAt)
}

/**
 * Heute fällige Erinnerungsstufe: der Berliner Kalendertag von `now` ist genau Frist − 7 bzw. − 1 Tage, und für diese
 * Frist wurde die Stufe noch nicht verschickt (`remindersSent[stufe]` liegt auf genau diesem Tag). Eine verlängerte
 * Frist verschiebt beide Stufen; an allen anderen Tagen `null`.
 */
export function privacyReminderDue(
  now: Date,
  target: Date,
  remindersSent: Record<string, unknown> | null | undefined,
): PrivacyReminderStage | null {
  const today = berlinDateKey(now)
  for (const stage of PRIVACY_REMINDER_STAGES) {
    const day = berlinDateKey(addBerlinDays(target, -stage.days))
    if (day !== today) continue
    const sent = remindersSent?.[stage.key]
    if (typeof sent === 'string' && berlinDateKey(new Date(sent)) === day) return null
    return stage.key
  }
  return null
}
