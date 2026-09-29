import type { TaskConfig } from 'payload'

import { withTaskLock } from '@/lib/jobs/lock'
import { jobNow } from '@/lib/jobs/now'

// Task `prepaymentReminders` (DATENMODELL §11, Queue `commerce`, PLAN P4.19): ab `reminderDueAt` genau einmal M03 (`reminderSentAt`). Fristen-Job:
// Beispiel-Bestellungen (`seed = true`) werden übersprungen. Ausgelöst vom Job-Wecker (Weckzeit bzw. stündliches Netz);
// Advisory-Lock je Task; schreibt den nächsten Weckzeitpunkt.

type DeadlineIO = {
  input: Record<string, never>
  output: { processed: number; skipped: boolean }
}

export const prepaymentRemindersTask: TaskConfig<DeadlineIO> = {
  slug: 'prepaymentReminders',
  label: 'Vorkasse-Erinnerungen senden',
  retries: 3,
  outputSchema: [
    { name: 'processed', type: 'number', required: true },
    { name: 'skipped', type: 'checkbox', required: true },
  ],
  handler: async ({ req }) => {
    const now = jobNow(req)
    // Dynamisch: der Dienst lädt (über die Reservierung) die Payload-Konfiguration, die diese Datei registriert.
    const { sendPrepaymentReminders } = await import('@/lib/commerce/prepayment')
    const run = await withTaskLock(req.payload, 'prepaymentReminders', () =>
      sendPrepaymentReminders(req.payload, now),
    )
    if (run.status === 'locked') return { output: { processed: 0, skipped: true } }
    return { output: { processed: run.result.processed, skipped: false } }
  },
}
