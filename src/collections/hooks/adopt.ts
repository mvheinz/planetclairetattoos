import type { CollectionBeforeChangeHook } from 'payload'

import { getAppContext } from '@/lib/payload/context'

// Übernahme („adopt“, DATENMODELL §13.4) für `pages` und `faqs`: jedes Speichern ohne `context.seed` macht aus einem
// Beispiel-Eintrag einen echten Eintrag (`seed = false`); `seedKey` bleibt erhalten (SEED-SPEC §1.3).
export const adoptOnSave: CollectionBeforeChangeHook = ({ data, req }) => {
  if (!getAppContext(req).seed) data.seed = false
  return data
}
