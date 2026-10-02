import type { TaskConfig } from 'payload'

import { withTaskLock } from '@/lib/jobs/lock'
import { jobNow } from '@/lib/jobs/now'
import { poolDb } from '@/lib/jobs/runLog'
import { runOncePer } from '@/lib/jobs/runOnce'

// Task `markDelivered` (DATENMODELL §11, Queue `commerce`, ARCHITEKTUR Anhang A.3, PLAN P5.16): täglich ab 03:00
// Berlin; `shipped`, deren Versandtag (Berliner Datum von `shippedAt`) mindestens 10 Kalendertage zurückliegt → O10 mit
// `shipment.deliveredSource = auto` und `timestamps.deliveredAt`, keine Mail. Einmal je Berliner Tag (`runOncePer`);
// ein zweiter Lauf findet nichts mehr (zustandsbasiert).

export const MARK_DELIVERED_BERLIN_HOUR = 3

type MarkDeliveredIO = {
  input: Record<string, never>
  output: { skipped: boolean; period?: string; delivered?: number; errors?: number }
}

export const markDeliveredTask: TaskConfig<MarkDeliveredIO> = {
  slug: 'markDelivered',
  label: 'Zustellung automatisch setzen',
  retries: 3,
  outputSchema: [
    { name: 'skipped', type: 'checkbox', required: true },
    { name: 'period', type: 'text' },
    { name: 'delivered', type: 'number' },
    { name: 'errors', type: 'number' },
  ],
  handler: async ({ req }) => {
    const now = jobNow(req)
    // Dynamisch: der Dienst lädt Bestell-Übergänge und Einstellungen (Payload-Konfiguration registriert diese Datei).
    const { markDeliveredAuto } = await import('@/lib/commerce/shipped')
    const run = await withTaskLock(req.payload, 'markDelivered', async () => {
      const decision = await runOncePer(
        poolDb(req.payload),
        'markDelivered',
        'day',
        MARK_DELIVERED_BERLIN_HOUR,
        now,
      )
      if (!decision.due) return null
      const res = await markDeliveredAuto(req.payload, now)
      return { period: decision.period, ...res }
    })
    if (run.status === 'locked' || run.result === null) return { output: { skipped: true } }
    return { output: { skipped: false, ...run.result } }
  },
}
