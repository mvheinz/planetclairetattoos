import type { TaskConfig } from 'payload'

import { withTaskLock } from '@/lib/jobs/lock'
import { jobNow } from '@/lib/jobs/now'
import { poolDb } from '@/lib/jobs/runLog'
import { runOncePer } from '@/lib/jobs/runOnce'

// Task `privacyRequestsDeadlineReminder` (DATENMODELL §11, Queue `maintenance`, ARCHITEKTUR Anhang A.3, PLAN P6.16,
// R-153): täglich ab 08:00 Berlin; offene Datenschutz-Anfragen 7 Tage und 1 Tag vor `extendedDueAt ?? dueAt` → A14,
// je Stufe einmal (`remindersSent`), Beispieldaten ausgenommen. Logik in `src/lib/privacy/reminders.ts`.

export const PRIVACY_REMINDER_BERLIN_HOUR = 8

type PrivacyReminderIO = {
  input: Record<string, never>
  output: { skipped: boolean; period?: string; reminded?: number }
}

export const privacyRequestsDeadlineReminderTask: TaskConfig<PrivacyReminderIO> = {
  slug: 'privacyRequestsDeadlineReminder',
  label: 'Datenschutz-Anfragen: Fristen-Erinnerung',
  retries: 3,
  outputSchema: [
    { name: 'skipped', type: 'checkbox', required: true },
    { name: 'period', type: 'text' },
    { name: 'reminded', type: 'number' },
  ],
  handler: async ({ req }) => {
    const now = jobNow(req)
    // Dynamisch: der Dienst lädt die Mail-Outbox (Payload-Konfiguration registriert diese Datei).
    const { runPrivacyRequestReminders } = await import('@/lib/privacy/reminders')
    const run = await withTaskLock(req.payload, 'privacyRequestsDeadlineReminder', async () => {
      const decision = await runOncePer(
        poolDb(req.payload),
        'privacyRequestsDeadlineReminder',
        'day',
        PRIVACY_REMINDER_BERLIN_HOUR,
        now,
      )
      if (!decision.due) return null
      const res = await runPrivacyRequestReminders(req.payload, now)
      return { period: decision.period, ...res }
    })
    if (run.status === 'locked' || run.result === null) return { output: { skipped: true } }
    return { output: { skipped: false, ...run.result } }
  },
}
