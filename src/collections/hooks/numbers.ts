import type { CollectionBeforeValidateHook } from 'payload'

import { nextSequenceNumber, type NumberKind } from '@/lib/db/sequences'
import { getAppContext, requestNow } from '@/lib/payload/context'

// Nummernvergabe beim Anlegen aus der Postgres-Sequenz (DATENMODELL §8.7, P1.26). Läuft vor der Feldvalidierung,
// damit das Pflichtfeld gefüllt ist. Ein vom Aufrufer übergebener Wert wird ersetzt (auch aus der Verwaltung);
// nur der Seed bringt feste Nummern mit (§13.3) und zieht keine Sequenzwerte.

export function assignSequenceNumber(
  field: string,
  kind: NumberKind,
): CollectionBeforeValidateHook {
  return async ({ data, operation, req }) => {
    if (operation !== 'create' || !data) return data
    if (getAppContext(req).seed) return data
    data[field] = await nextSequenceNumber(req, kind, requestNow(req))
    return data
  }
}
