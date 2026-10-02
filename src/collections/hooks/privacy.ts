import type { CollectionAfterChangeHook } from 'payload'

import { writeAudit } from '@/lib/audit'
import { getAppContext } from '@/lib/payload/context'

// Audit der Datenschutz-Schalter aus `privacyFields()` (DATENMODELL §5, LOESCHKONZEPT §1 Nr. 2, §4 Regel 3):
// `legal_hold_changed` beim Setzen/Aufheben bzw. neuer Begründung eines Legal Holds, `processing_restricted` beim
// Ein-/Ausschalten der Einschränkung. Ohne Inhalte (die Begründung kann Personenbezug haben).

type Privacy = {
  legalHold?: boolean | null
  legalHoldReason?: string | null
  processingRestricted?: boolean | null
}

export function auditPrivacyFlags(collection: string): CollectionAfterChangeHook {
  return async ({ doc, previousDoc, operation, req }) => {
    if (operation !== 'update' || getAppContext(req).seed) return doc
    const before = ((previousDoc as { privacy?: Privacy } | undefined)?.privacy ?? {}) as Privacy
    const after = ((doc as { privacy?: Privacy }).privacy ?? {}) as Privacy
    const seed = Boolean((doc as { seed?: boolean | null }).seed)
    const holdBefore = before.legalHold === true
    const holdAfter = after.legalHold === true
    const reasonChanged =
      holdAfter && (before.legalHoldReason ?? '') !== (after.legalHoldReason ?? '')
    if (holdBefore !== holdAfter || reasonChanged) {
      await writeAudit(req, {
        action: 'legal_hold_changed',
        entityCollection: collection,
        entityId: doc.id,
        summary: holdAfter
          ? `Legal Hold ${holdBefore ? 'Begründung geändert' : 'gesetzt'} (${collection} ${doc.id})`
          : `Legal Hold aufgehoben (${collection} ${doc.id})`,
        changes: { 'privacy.legalHold': [holdBefore, holdAfter] },
        seed,
      })
    }
    const restrictedBefore = before.processingRestricted === true
    const restrictedAfter = after.processingRestricted === true
    if (restrictedBefore !== restrictedAfter) {
      await writeAudit(req, {
        action: 'processing_restricted',
        entityCollection: collection,
        entityId: doc.id,
        summary: `Verarbeitung ${restrictedAfter ? 'eingeschränkt' : 'wieder frei'} (${collection} ${doc.id})`,
        changes: { 'privacy.processingRestricted': [restrictedBefore, restrictedAfter] },
        seed,
      })
    }
    return doc
  }
}
