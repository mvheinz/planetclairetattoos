import type { TaskConfig } from 'payload'

import { withTaskLock } from '@/lib/jobs/lock'
import { jobNow } from '@/lib/jobs/now'
import { poolDb } from '@/lib/jobs/runLog'
import { runOncePer } from '@/lib/jobs/runOnce'

// Task `monthlyClose` (DATENMODELL §11, Queue `documents`, KONZEPT §8.2, PLAN P5.26): monatlich am 1. ab 04:00 Berlin
// (`runOncePer`, erster voller Lauf danach) für den Vormonat Monats-CSV und Rechnungs-ZIP privat ablegen und A11 senden.
// Je Monat nur einmal (Lauf-Protokoll + vorhandene Ablage). Fehlt noch ein Beleg-PDF, scheitert der Lauf und wird
// wiederholt (Queue `documents` ⇒ A12 über das Lauf-Protokoll).

export const MONTHLY_CLOSE_BERLIN_HOUR = 4

type MonthlyCloseIO = {
  input: Record<string, never>
  output: { skipped: boolean; period?: string; month?: string; uploads?: number }
}

export const monthlyCloseTask: TaskConfig<MonthlyCloseIO> = {
  slug: 'monthlyClose',
  label: 'Monatsabschluss',
  retries: 3,
  outputSchema: [
    { name: 'skipped', type: 'checkbox', required: true },
    { name: 'period', type: 'text' },
    { name: 'month', type: 'text' },
    { name: 'uploads', type: 'number' },
  ],
  handler: async ({ req }) => {
    const now = jobNow(req)
    const { runMonthlyClose } = await import('@/lib/export/monthlyClose')
    const run = await withTaskLock(req.payload, 'monthlyClose', async () => {
      const decision = await runOncePer(
        poolDb(req.payload),
        'monthlyClose',
        'month',
        MONTHLY_CLOSE_BERLIN_HOUR,
        now,
      )
      if (!decision.due) return null
      const res = await runMonthlyClose(req.payload, now)
      return { period: decision.period, month: res.month, uploads: res.uploadIds.length }
    })
    if (run.status === 'locked' || run.result === null) return { output: { skipped: true } }
    return { output: { skipped: false, ...run.result } }
  },
}
