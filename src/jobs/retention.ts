import type { TaskConfig } from 'payload'

import { withTaskLock } from '@/lib/jobs/lock'
import { jobNow } from '@/lib/jobs/now'
import { poolDb } from '@/lib/jobs/runLog'
import { runOncePer } from '@/lib/jobs/runOnce'

// Löschjobs (ARCHITEKTUR Anhang A.3, LOESCHKONZEPT §4, DATENMODELL §11, PLAN P6.14/P6.15): täglich zur Richtzeit aus
// LOESCHKONZEPT §4 (Europe/Berlin), höchstens einmal je Berliner Tag (`runOncePer`), nie parallel (`withTaskLock`).
// Die Arbeit macht der gemeinsame Runner (`src/lib/retention/runner.ts`) mit den Schritten aus
// `src/lib/retention/jobs.ts`; Zeit aus der injizierten Uhr (`jobNow`).

/** Richtzeiten je Löschjob (LOESCHKONZEPT §4). */
export const RETENTION_SCHEDULE = {
  retentionAbandonedCheckouts: { berlinHour: 3, berlinMinute: 5, label: 'Kassen löschen (L-03)' },
  retentionOrderMinimize: {
    berlinHour: 3,
    berlinMinute: 10,
    label: 'Bestellungen minimieren (L-04, L-05)',
  },
  retentionOrders: {
    berlinHour: 3,
    berlinMinute: 15,
    label: 'Bestellungen anonymisieren (L-05 D)',
  },
  retentionInvoices: {
    berlinHour: 3,
    berlinMinute: 20,
    label: 'Belege nach Fristende (L-06, L-07)',
  },
  retentionWithdrawals: { berlinHour: 3, berlinMinute: 25, label: 'Widerrufe löschen (L-08)' },
  retentionCommissionInquiries: {
    berlinHour: 3,
    berlinMinute: 30,
    label: 'Anfragen löschen (L-10)',
  },
  retentionEmailLog: { berlinHour: 3, berlinMinute: 35, label: 'Mail-Protokoll löschen (L-12)' },
  retentionPrivacyRequests: {
    berlinHour: 3,
    berlinMinute: 40,
    label: 'Datenschutz-Anfragen löschen (L-17)',
  },
  retentionConsentEvidence: {
    berlinHour: 3,
    berlinMinute: 45,
    label: 'Einwilligungsnachweise löschen (L-19, L-20)',
  },
  retentionDeletionLog: { berlinHour: 3, berlinMinute: 50, label: 'Löschprotokoll kürzen (L-18)' },
} as const

export type ScheduledRetentionTask = keyof typeof RETENTION_SCHEDULE

type RetentionIO = {
  input: Record<string, never>
  output: { skipped: boolean; period?: string; processed?: number; failed?: number }
}

function retentionTask(slug: ScheduledRetentionTask): TaskConfig<RetentionIO> {
  const { berlinHour, berlinMinute, label } = RETENTION_SCHEDULE[slug]
  return {
    slug,
    label,
    retries: 3,
    outputSchema: [
      { name: 'skipped', type: 'checkbox', required: true },
      { name: 'period', type: 'text' },
      { name: 'processed', type: 'number' },
      { name: 'failed', type: 'number' },
    ],
    handler: async ({ req }) => {
      const now = jobNow(req)
      // Dynamisch: die Löschschritte laden Mail-Outbox und Speicher (Payload-Konfiguration registriert diese Datei)
      const { runRetentionTask } = await import('@/lib/retention/jobs')
      const run = await withTaskLock(req.payload, slug, async () => {
        const decision = await runOncePer(
          poolDb(req.payload),
          slug,
          'day',
          berlinHour,
          now,
          berlinMinute,
        )
        if (!decision.due) return null
        const res = await runRetentionTask(req.payload, slug, { now })
        return { period: decision.period, processed: res.processed, failed: res.failed }
      })
      if (run.status === 'locked' || run.result === null) return { output: { skipped: true } }
      return { output: { skipped: false, ...run.result } }
    },
  }
}

export const retentionAbandonedCheckoutsTask = retentionTask('retentionAbandonedCheckouts')
export const retentionOrderMinimizeTask = retentionTask('retentionOrderMinimize')
export const retentionOrdersTask = retentionTask('retentionOrders')
export const retentionInvoicesTask = retentionTask('retentionInvoices')
export const retentionWithdrawalsTask = retentionTask('retentionWithdrawals')
export const retentionCommissionInquiriesTask = retentionTask('retentionCommissionInquiries')
export const retentionEmailLogTask = retentionTask('retentionEmailLog')
export const retentionPrivacyRequestsTask = retentionTask('retentionPrivacyRequests')
export const retentionConsentEvidenceTask = retentionTask('retentionConsentEvidence')
export const retentionDeletionLogTask = retentionTask('retentionDeletionLog')

/** `retentionTechnical` (L-02, L-13): stündlich mit jedem vollen Lauf des Job-Weckers, ohne Tagessperre. */
export const retentionTechnicalTask: TaskConfig<RetentionIO> = {
  slug: 'retentionTechnical',
  label: 'Technische Protokolle löschen (L-02, L-13)',
  retries: 3,
  outputSchema: [
    { name: 'skipped', type: 'checkbox', required: true },
    { name: 'processed', type: 'number' },
    { name: 'failed', type: 'number' },
  ],
  handler: async ({ req }) => {
    const now = jobNow(req)
    const { runRetentionTask } = await import('@/lib/retention/jobs')
    const run = await withTaskLock(req.payload, 'retentionTechnical', () =>
      runRetentionTask(req.payload, 'retentionTechnical', { now }),
    )
    if (run.status === 'locked') return { output: { skipped: true } }
    return {
      output: { skipped: false, processed: run.result.processed, failed: run.result.failed },
    }
  },
}

/** Erinnerung an Legal Holds: täglich ab 08:00 Berlin, einmal je Tag (DATENMODELL §11, LOESCHKONZEPT §4). */
export const LEGAL_HOLD_REVIEW_BERLIN_HOUR = 8

export const legalHoldReviewTask: TaskConfig<{
  input: Record<string, never>
  output: { skipped: boolean; period?: string; sent?: boolean; holds?: number }
}> = {
  slug: 'legalHoldReview',
  label: 'Aufbewahrungssperren prüfen (Erinnerung)',
  retries: 3,
  outputSchema: [
    { name: 'skipped', type: 'checkbox', required: true },
    { name: 'period', type: 'text' },
    { name: 'sent', type: 'checkbox' },
    { name: 'holds', type: 'number' },
  ],
  handler: async ({ req }) => {
    const now = jobNow(req)
    const { runLegalHoldReview } = await import('@/lib/retention/jobs')
    const run = await withTaskLock(req.payload, 'legalHoldReview', async () => {
      const decision = await runOncePer(
        poolDb(req.payload),
        'legalHoldReview',
        'day',
        LEGAL_HOLD_REVIEW_BERLIN_HOUR,
        now,
      )
      if (!decision.due) return null
      const res = await runLegalHoldReview(req, now)
      return { period: decision.period, ...res }
    })
    if (run.status === 'locked' || run.result === null) return { output: { skipped: true } }
    return { output: { skipped: false, ...run.result } }
  },
}
