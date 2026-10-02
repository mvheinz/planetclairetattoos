import type { TaskConfig } from 'payload'

import { withTaskLock } from '@/lib/jobs/lock'
import { jobNow } from '@/lib/jobs/now'
import { poolDb } from '@/lib/jobs/runLog'
import { runOncePer } from '@/lib/jobs/runOnce'

// Task `withdrawalDeadlines` (DATENMODELL §11, Queue `commerce`, ARCHITEKTUR Anhang A.3, PLAN P6.9): täglich ab 08:00
// Berlin; offene Widerrufe ohne Erstattung ab Tag 10 nach Eingang → A13 einmal je Widerruf (`deadlineReminderSentAt`),
// Beispieldaten ausgenommen. Logik in `src/lib/legal/withdrawalDeadlines.ts`.

export const WITHDRAWAL_DEADLINES_BERLIN_HOUR = 8

type WithdrawalDeadlinesIO = {
  input: Record<string, never>
  output: { skipped: boolean; period?: string; reminded?: number }
}

export const withdrawalDeadlinesTask: TaskConfig<WithdrawalDeadlinesIO> = {
  slug: 'withdrawalDeadlines',
  label: 'Widerrufe: Erinnerung an die Erstattungsfrist',
  retries: 3,
  outputSchema: [
    { name: 'skipped', type: 'checkbox', required: true },
    { name: 'period', type: 'text' },
    { name: 'reminded', type: 'number' },
  ],
  handler: async ({ req }) => {
    const now = jobNow(req)
    // Dynamisch: der Dienst lädt die Mail-Outbox (Payload-Konfiguration registriert diese Datei).
    const { runWithdrawalDeadlines } = await import('@/lib/legal/withdrawalDeadlines')
    const run = await withTaskLock(req.payload, 'withdrawalDeadlines', async () => {
      const decision = await runOncePer(
        poolDb(req.payload),
        'withdrawalDeadlines',
        'day',
        WITHDRAWAL_DEADLINES_BERLIN_HOUR,
        now,
      )
      if (!decision.due) return null
      const res = await runWithdrawalDeadlines(req.payload, now)
      return { period: decision.period, ...res }
    })
    if (run.status === 'locked' || run.result === null) return { output: { skipped: true } }
    return { output: { skipped: false, ...run.result } }
  },
}
