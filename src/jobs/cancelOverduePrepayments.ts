import type { TaskConfig } from 'payload'

import { withTaskLock } from '@/lib/jobs/lock'
import { jobNow } from '@/lib/jobs/now'

// Task `cancelOverduePrepayments` (DATENMODELL §11, Queue `commerce`, PLAN P4.19): sobald `dueAt < now` O4 (`payment_timeout`), Freigabe, M04 + A03. Fristen-Job:
// Beispiel-Bestellungen (`seed = true`) werden übersprungen. Ausgelöst vom Job-Wecker (Weckzeit bzw. stündliches Netz);
// Advisory-Lock je Task; schreibt den nächsten Weckzeitpunkt.

type DeadlineIO = {
  input: Record<string, never>
  output: { processed: number; skipped: boolean }
}

export const cancelOverduePrepaymentsTask: TaskConfig<DeadlineIO> = {
  slug: 'cancelOverduePrepayments',
  label: 'Überfällige Vorkasse stornieren',
  retries: 3,
  outputSchema: [
    { name: 'processed', type: 'number', required: true },
    { name: 'skipped', type: 'checkbox', required: true },
  ],
  handler: async ({ req }) => {
    const now = jobNow(req)
    // Dynamisch: der Dienst lädt (über die Reservierung) die Payload-Konfiguration, die diese Datei registriert.
    const { cancelOverduePrepayments } = await import('@/lib/commerce/prepayment')
    const run = await withTaskLock(req.payload, 'cancelOverduePrepayments', () =>
      cancelOverduePrepayments(req.payload, now),
    )
    if (run.status === 'locked') return { output: { processed: 0, skipped: true } }
    return { output: { processed: run.result.processed, skipped: false } }
  },
}
