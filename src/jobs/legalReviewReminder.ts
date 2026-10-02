import type { TaskConfig } from 'payload'

import { withTaskLock } from '@/lib/jobs/lock'
import { jobNow } from '@/lib/jobs/now'
import { poolDb } from '@/lib/jobs/runLog'
import { runOncePer } from '@/lib/jobs/runOnce'

// Task `legalReviewReminder` (DATENMODELL §11, Queue `maintenance`, ARCHITEKTUR Anhang A.3, PLAN P6.20, R-014):
// täglich ab 08:30 Berlin je Rechtstext-Typ das Alter prüfen (jüngeres Datum aus `activatedAt` und
// `settings.legal.reviews[type].reviewedAt`); ab dem Intervall (Standard 365 Tage) A10 mit allen fälligen Typen, danach
// alle 30 Tage erneut (`lastReminderSentAt`). Einmal je Berliner Tag (`runOncePer`); Logik in `src/lib/legal/review.ts`.

export const LEGAL_REVIEW_TASK_BERLIN_HOUR = 8
export const LEGAL_REVIEW_TASK_BERLIN_MINUTE = 30

type LegalReviewIO = {
  input: Record<string, never>
  output: { skipped: boolean; period?: string; sent?: boolean; due?: number }
}

export const legalReviewReminderTask: TaskConfig<LegalReviewIO> = {
  slug: 'legalReviewReminder',
  label: 'Rechtstexte: jährliche Prüf-Erinnerung',
  retries: 3,
  outputSchema: [
    { name: 'skipped', type: 'checkbox', required: true },
    { name: 'period', type: 'text' },
    { name: 'sent', type: 'checkbox' },
    { name: 'due', type: 'number' },
  ],
  handler: async ({ req }) => {
    const now = jobNow(req)
    // Dynamisch: der Dienst lädt die Mail-Outbox (Payload-Konfiguration registriert diese Datei).
    const { runLegalReviewReminder } = await import('@/lib/legal/review')
    const run = await withTaskLock(req.payload, 'legalReviewReminder', async () => {
      const decision = await runOncePer(
        poolDb(req.payload),
        'legalReviewReminder',
        'day',
        LEGAL_REVIEW_TASK_BERLIN_HOUR,
        now,
        LEGAL_REVIEW_TASK_BERLIN_MINUTE,
      )
      if (!decision.due) return null
      const res = await runLegalReviewReminder(req, now)
      return { period: decision.period, sent: res.sent, due: res.due.length }
    })
    if (run.status === 'locked' || run.result === null) return { output: { skipped: true } }
    return { output: { skipped: false, ...run.result } }
  },
}
