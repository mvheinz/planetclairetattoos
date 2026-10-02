import type { TaskConfig } from 'payload'

import { withTaskLock } from '@/lib/jobs/lock'
import { jobNow } from '@/lib/jobs/now'

// Task `revenueGuardCheck` (DATENMODELL §11, Queue `maintenance`, KONZEPT §8.4, PLAN P5.23): Umsatz des laufenden
// Jahres berechnen, neue Stufen genau einmal je Jahr per A09 melden (`settings.revenueGuard.lastNotified`); U0 beim
// ersten Lauf im neuen Jahr. Ausgelöst vom Job-Wecker ab 07:00 Berlin (`WAKE_TASK_NOT_BEFORE_HOUR`) und nach jeder
// Beleg- oder Monatssummen-Änderung (`queueRevenueGuardCheck`). Advisory-Lock je Task; Doppel-Lauf ohne zweite Mail.

type RevenueGuardIO = {
  input: Record<string, never>
  output: { notified: number; skipped: boolean }
}

export const revenueGuardCheckTask: TaskConfig<RevenueGuardIO> = {
  slug: 'revenueGuardCheck',
  label: 'Umsatz-Wächter prüfen',
  retries: 3,
  outputSchema: [
    { name: 'notified', type: 'number', required: true },
    { name: 'skipped', type: 'checkbox', required: true },
  ],
  handler: async ({ req }) => {
    const now = jobNow(req)
    // Dynamisch: der Dienst lädt Mail-Outbox und Einstellungen (Payload-Konfiguration registriert diese Datei).
    const { runRevenueGuardCheck } = await import('@/lib/revenue/check')
    const run = await withTaskLock(req.payload, 'revenueGuardCheck', () =>
      runRevenueGuardCheck(req.payload, now),
    )
    if (run.status === 'locked') return { output: { notified: 0, skipped: true } }
    return { output: { notified: run.result.notified.length, skipped: false } }
  },
}
