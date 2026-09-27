import 'server-only'

import type { PayloadRequest } from 'payload'

import type { DeletionAction, DeletionTrigger } from '@/lib/enums'

// Löschprotokoll (DATENMODELL §6.27, L-18): in derselben Transaktion wie die Aktion (req weitergeben),
// ohne Inhalte, Namen oder E-Mail-Adressen.

export interface DeletionLogEntry {
  entityCollection: string
  entityId: number | string
  /** `L-xx[ a][ Stufe X]`, `DSGVO` oder `ADMIN` */
  ruleId: string
  action: DeletionAction
  trigger: DeletionTrigger
  taskSlug?: string
  privacyRequestRef?: string
  storageObjectsCount?: number
  executedAt: Date
}

export async function writeDeletionLog(req: PayloadRequest, entry: DeletionLogEntry) {
  const previous = req.context
  try {
    return await req.payload.create({
      collection: 'deletion-log',
      data: {
        entityCollection: entry.entityCollection,
        entityId: String(entry.entityId),
        ruleId: entry.ruleId,
        action: entry.action,
        trigger: entry.trigger,
        taskSlug: entry.taskSlug,
        privacyRequestRef: entry.privacyRequestRef,
        storageObjectsCount: entry.storageObjectsCount ?? 0,
        executedAt: entry.executedAt.toISOString(),
        retainUntil: entry.executedAt.toISOString(), // wird im Hook aus L-18 berechnet
      },
      req,
      overrideAccess: true,
      context: { skipAudit: true },
    })
  } finally {
    req.context = previous
  }
}
