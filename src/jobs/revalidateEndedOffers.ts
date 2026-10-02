import type { TaskConfig } from 'payload'

import { withTaskLock } from '@/lib/jobs/lock'
import { jobNow } from '@/lib/jobs/now'

// Task `revalidateEndedOffers` (DATENMODELL §11, Queue `maintenance`, ARCHITEKTUR Anhang A.3, PLAN P7.3): Beginn und Ende
// von Angeboten auf den statischen Seiten R01, R11, R13 sichtbar machen (R-171). Geweckt über `jobAlarm.bump` an
// `startsAt`/`endsAt` (Collection-Hook und dieser Task) und über jeden vollen Lauf des Job-Weckers; Sicherheitsnetz
// täglich ab 00:05 Berlin. Ohne Fälliges: `skipped` (kein zusätzlicher Effekt, AK-8-01).

type RevalidateOffersIO = {
  input: Record<string, never>
  output: {
    skipped: boolean
    revalidated?: boolean
    boundaries?: number
    period?: string | null
    handledUntil?: string
    nextDueAt?: string | null
    targets?: number
  }
}

export const revalidateEndedOffersTask: TaskConfig<RevalidateOffersIO> = {
  slug: 'revalidateEndedOffers',
  label: 'Abgelaufene Angebote ausblenden',
  retries: 3,
  outputSchema: [
    { name: 'skipped', type: 'checkbox', required: true },
    { name: 'revalidated', type: 'checkbox' },
    { name: 'boundaries', type: 'number' },
    { name: 'period', type: 'text' },
    { name: 'handledUntil', type: 'text' },
    { name: 'nextDueAt', type: 'text' },
    { name: 'targets', type: 'number' },
  ],
  handler: async ({ req }) => {
    const now = jobNow(req)
    // Dynamisch: der Dienst lädt Collections und den Wecker (Payload-Konfiguration registriert diese Datei).
    const { revalidateEndedOffers } = await import('@/lib/tattoo/revalidateOffers')
    const { jobAlarm } = await import('@/lib/jobs/alarm')
    const run = await withTaskLock(req.payload, 'revalidateEndedOffers', () =>
      revalidateEndedOffers(req, now),
    )
    if (run.status === 'locked') return { output: { skipped: true } }
    const r = run.result
    if (r.nextDueAt) await jobAlarm.bump(r.nextDueAt).catch(() => undefined)
    return {
      output: {
        // Nichts Fälliges: als `skipped` protokolliert, ohne `handledUntil` (der nächste Lauf zählt ab dem letzten Lauf).
        skipped: !r.revalidated,
        revalidated: r.revalidated,
        boundaries: r.boundaries,
        period: r.period,
        handledUntil: r.revalidated ? r.handledUntil : undefined,
        nextDueAt: r.nextDueAt?.toISOString() ?? null,
        targets: r.targets.length,
      },
    }
  },
}
