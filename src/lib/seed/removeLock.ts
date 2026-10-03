import 'server-only'

import type { Payload } from 'payload'

import { LEGAL_TEXT_TYPES, type LegalTextType } from '@/lib/enums'
import { getActiveLegalText } from '@/lib/legal/getActive'

// Sperre von „Beispieldaten entfernen“ in der Verwaltung (KONZEPT §11.3, DATENMODELL §13.5, R-002): gesperrt, solange
// für irgendeinen der sechs Rechtstext-Typen keine aktive Fassung existiert oder die aktive Fassung ein Platzhalter ist
// (`origin = placeholder` ⇒ `isPlaceholder = true`) – sonst wären die Rechtsseiten nach dem Entfernen leer. Die CLI
// `seed:remove` kennt diese Sperre nicht.

export const SEED_REMOVE_LOCK_TEXT =
  'Bitte zuerst die Texte der Kanzlei einsetzen – sonst wären die Rechtsseiten leer.'

/** Typen, deren aktive Fassung fehlt oder ein Platzhalter ist (leer = nicht gesperrt). */
export async function seedRemovalLockedTypes(payload: Payload, at: Date): Promise<LegalTextType[]> {
  const locked: LegalTextType[] = []
  for (const type of LEGAL_TEXT_TYPES) {
    const active = await getActiveLegalText(type, at, { payload, fallbackLocale: false })
    if (!active || active.isPlaceholder === true || active.origin === 'placeholder')
      locked.push(type)
  }
  return locked
}
