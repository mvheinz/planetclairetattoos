import { createLocalReq, type TaskConfig } from 'payload'

import { withTaskLock } from '@/lib/jobs/lock'
import { jobNow } from '@/lib/jobs/now'

// Task `activateScheduledLegalTexts` (DATENMODELL §11, Queue `maintenance`, ARCHITEKTUR Anhang A.3, PLAN P6.3):
// geplante Rechtstext- und Baustein-Fassungen am `validFrom` aktivieren (Service `activateLegalText` bzw.
// `activateLegalSnippet`, je Fassung eine Transaktion; Vorgänger → `superseded`, PDF-Job). Geweckt über
// `jobAlarm.bump(validFrom)` beim Planen und über jeden vollen Lauf des Job-Weckers. Zustandsbasiert: ein zweiter Lauf
// findet keine fällige Fassung mehr.

type ActivateScheduledIO = {
  input: Record<string, never>
  output: { skipped: boolean; activated?: number; failed?: number; nextDueAt?: string | null }
}

export const activateScheduledLegalTextsTask: TaskConfig<ActivateScheduledIO> = {
  slug: 'activateScheduledLegalTexts',
  label: 'Geplante Rechtstexte aktivieren',
  retries: 3,
  outputSchema: [
    { name: 'skipped', type: 'checkbox', required: true },
    { name: 'activated', type: 'number' },
    { name: 'failed', type: 'number' },
    { name: 'nextDueAt', type: 'text' },
  ],
  handler: async ({ req }) => {
    const now = jobNow(req)
    // Dynamisch: der Dienst lädt Collections und Jobs (Payload-Konfiguration registriert diese Datei).
    const { activateScheduledLegalVersions } = await import('@/lib/legal/activate')
    const { jobAlarm } = await import('@/lib/jobs/alarm')
    const run = await withTaskLock(req.payload, 'activateScheduledLegalTexts', () =>
      activateScheduledLegalVersions(
        () => createLocalReq({ context: { system: true, now: now.toISOString() } }, req.payload),
        now,
      ),
    )
    if (run.status === 'locked') return { output: { skipped: true } }
    const { activated, failed, nextDueAt } = run.result
    if (nextDueAt) await jobAlarm.bump(nextDueAt).catch(() => undefined)
    return {
      output: {
        skipped: false,
        activated: activated.length,
        failed: failed.length,
        nextDueAt: nextDueAt?.toISOString() ?? null,
      },
    }
  },
}
