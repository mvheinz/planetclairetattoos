import type { TaskConfig } from 'payload'

import { withTaskLock } from '@/lib/jobs/lock'
import { jobNow } from '@/lib/jobs/now'

// Task `releaseExpiredReservations` (DATENMODELL §11, Queue `commerce`, PLAN P4.18): abgelaufene Kassen-Reservierungen
// freigeben bzw. bei „bezahlt“ abschließen, Kassen in `confirming` abgleichen, Weckzeit schreiben. Ausgelöst vom
// Job-Wecker (Weckzeit `expiresAt`, Kasse `confirming` + 10 min, stündliches Netz); Advisory-Lock je Task.

type ReleaseExpiredIO = {
  input: Record<string, never>
  output: { released: number; fulfilled: number; reopened: number; skipped: boolean }
}

export const releaseExpiredReservationsTask: TaskConfig<ReleaseExpiredIO> = {
  slug: 'releaseExpiredReservations',
  label: 'Reservierungen freigeben und Kassen abgleichen',
  retries: 3,
  outputSchema: [
    { name: 'released', type: 'number', required: true },
    { name: 'fulfilled', type: 'number', required: true },
    { name: 'reopened', type: 'number', required: true },
    { name: 'skipped', type: 'checkbox', required: true },
  ],
  handler: async ({ req }) => {
    const now = jobNow(req)
    // Dynamisch: der Dienst lädt (über die Reservierung) die Payload-Konfiguration, die diese Datei registriert.
    const { releaseExpiredReservations } = await import('@/lib/commerce/expiry')
    const run = await withTaskLock(req.payload, 'releaseExpiredReservations', () =>
      releaseExpiredReservations({ payload: req.payload, now }),
    )
    if (run.status === 'locked') {
      return { output: { released: 0, fulfilled: 0, reopened: 0, skipped: true } }
    }
    const { released, fulfilled, reopened } = run.result
    return { output: { released, fulfilled, reopened, skipped: false } }
  },
}
