import type { Payload, PayloadRequest, Where } from 'payload'

// Verweise auf Medien (DATENMODELL §6.2 `beforeDelete`): Collections mit Upload-Feldern registrieren sich hier, damit
// ein Bild nicht gelöscht werden kann, solange ein veröffentlichter Eintrag es nutzt. Jede Collection registriert ihre
// Felder beim Import ihres Moduls (z. B. Produkte mit `status ≠ draft`, veröffentlichte Flash-Motive …).

export interface MediaReference {
  /** Collection mit dem Upload-Feld, z. B. `products`. */
  collection: string
  /** Pfad des Upload-/Relationship-Felds, z. B. `images.image` oder `heroImage`. */
  path: string
  /** Nur diese Einträge zählen (z. B. `{ status: { not_equals: 'draft' } }`); ohne Angabe alle. */
  where?: Where
  /** Eigene Abfrage statt `{ [path]: { equals: id } }` (z. B. für Textfelder). */
  match?: (mediaId: number | string) => Where
  /** Bezeichnung in der Meldung, z. B. „Stück“. */
  label: string
  /** Titel-Feld für die Meldung (Standard `id`). */
  titleField?: string
}

const registry = new Map<string, MediaReference>()
const keyOf = (r: Pick<MediaReference, 'collection' | 'path'>) => `${r.collection}:${r.path}`

/** Registriert ein Upload-Feld; gibt eine Funktion zum Abmelden zurück (Tests). */
export function registerMediaReference(ref: MediaReference): () => void {
  registry.set(keyOf(ref), ref)
  return () => {
    registry.delete(keyOf(ref))
  }
}

export function listMediaReferences(): MediaReference[] {
  return [...registry.values()]
}

export interface FoundReference {
  collection: string
  label: string
  id: number | string
  title: string
}

/** Sucht alle zählenden Verweise auf ein Bild (höchstens 10 je Feld). */
export async function findMediaReferences(
  payload: Payload,
  mediaId: number | string,
  req?: PayloadRequest,
): Promise<FoundReference[]> {
  const found: FoundReference[] = []
  for (const ref of registry.values()) {
    if (!payload.collections[ref.collection as 'users']) continue
    const match = ref.match ? ref.match(mediaId) : { [ref.path]: { equals: mediaId } }
    const res = await payload.find({
      collection: ref.collection as 'users',
      where: ref.where ? { and: [match, ref.where] } : match,
      limit: 10,
      depth: 0,
      overrideAccess: true,
      req,
    })
    for (const doc of res.docs as unknown as Record<string, unknown>[]) {
      const title = ref.titleField ? doc[ref.titleField] : undefined
      found.push({
        collection: ref.collection,
        label: ref.label,
        id: doc.id as number | string,
        title:
          typeof title === 'string' || typeof title === 'number' ? String(title) : String(doc.id),
      })
    }
  }
  return found
}

/** Deutsche Meldung für die Verwaltung, z. B. „Das Bild wird noch verwendet: Stück Nr. 017, …“. */
export function formatReferenceMessage(refs: FoundReference[]): string {
  const list = refs.map((r) => `${r.label} ${r.title}`).join(', ')
  return `Das Bild wird noch verwendet und kann nicht gelöscht werden: ${list}.`
}
