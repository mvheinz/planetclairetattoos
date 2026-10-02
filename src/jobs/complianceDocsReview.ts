import type { TaskConfig } from 'payload'

import { withTaskLock } from '@/lib/jobs/lock'
import { jobNow } from '@/lib/jobs/now'
import { poolDb } from '@/lib/jobs/runLog'
import { runOncePer } from '@/lib/jobs/runOnce'

// Task `complianceDocsReview` (DATENMODELL §11, Queue `maintenance`, LOESCHKONZEPT L-24, PLAN P5.13): monatlich am 1.
// ab 08:10 Berlin A16 mit Kategorien ohne technische Unterlagen und Unterlagen mit abgelaufener 10-Jahres-Frist („kann
// gelöscht werden“) – keine automatische Löschung, Beispieldaten zählen nicht. Einmal je Berliner Monat (`runOncePer`).

export const COMPLIANCE_REVIEW_BERLIN_HOUR = 8
export const COMPLIANCE_REVIEW_BERLIN_MINUTE = 10

type ComplianceReviewIO = {
  input: Record<string, never>
  output: {
    skipped: boolean
    period?: string
    sent?: boolean
    missing?: number
    deletable?: number
  }
}

export const complianceDocsReviewTask: TaskConfig<ComplianceReviewIO> = {
  slug: 'complianceDocsReview',
  label: 'Produktsicherheits-Unterlagen prüfen',
  retries: 3,
  outputSchema: [
    { name: 'skipped', type: 'checkbox', required: true },
    { name: 'period', type: 'text' },
    { name: 'sent', type: 'checkbox' },
    { name: 'missing', type: 'number' },
    { name: 'deletable', type: 'number' },
  ],
  handler: async ({ req }) => {
    const now = jobNow(req)
    // Dynamisch: der Dienst lädt die Mail-Outbox (Payload-Konfiguration registriert diese Datei).
    const { runComplianceDocsReview } = await import('@/lib/legal/complianceDocs')
    const run = await withTaskLock(req.payload, 'complianceDocsReview', async () => {
      const decision = await runOncePer(
        poolDb(req.payload),
        'complianceDocsReview',
        'month',
        COMPLIANCE_REVIEW_BERLIN_HOUR,
        now,
        COMPLIANCE_REVIEW_BERLIN_MINUTE,
      )
      if (!decision.due) return null
      const res = await runComplianceDocsReview(req, now, decision.period)
      return {
        period: decision.period,
        sent: res.sent,
        missing: res.missingCategories.length,
        deletable: res.deletable,
      }
    })
    if (run.status === 'locked' || run.result === null) return { output: { skipped: true } }
    return { output: { skipped: false, ...run.result } }
  },
}
