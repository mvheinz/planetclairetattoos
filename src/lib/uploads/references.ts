import type { Payload, PayloadRequest, Where } from 'payload'

// Verweise auf Dateien in `documents` und `private-uploads` (DATENMODELL §6.3/§6.4 `beforeDelete`): Collections mit
// Upload-Feldern auf diese Bereiche registrieren sich hier (beim Import ihres Moduls), damit eine Datei nicht gelöscht
// wird, solange ein zählender Eintrag sie nutzt (z. B. aktive Konformitätserklärung, Stück mit Nickel-Nachweis).

export type UploadTarget = 'documents' | 'private-uploads'

export interface UploadReference {
  /** Collection, auf deren Dateien verwiesen wird. */
  target: UploadTarget
  /** Collection mit dem Upload-Feld, z. B. `conformity-declarations`. */
  collection: string
  /** Pfad des Upload-Felds, z. B. `labReport`. */
  path: string
  /** Nur diese Einträge zählen (z. B. `{ status: { equals: 'active' } }`). */
  where?: Where
  /** Bezeichnung in der Meldung, z. B. „Konformitätserklärung“. */
  label: string
  /** Titel-Feld für die Meldung (Standard `id`). */
  titleField?: string
}

const registry = new Map<string, UploadReference>()
const keyOf = (r: Pick<UploadReference, 'target' | 'collection' | 'path'>) =>
  `${r.target}:${r.collection}:${r.path}`

/** Registriert ein Upload-Feld; gibt eine Funktion zum Abmelden zurück (Tests). */
export function registerUploadReference(ref: UploadReference): () => void {
  registry.set(keyOf(ref), ref)
  return () => {
    registry.delete(keyOf(ref))
  }
}

export function listUploadReferences(target?: UploadTarget): UploadReference[] {
  return [...registry.values()].filter((r) => !target || r.target === target)
}

export interface FoundUploadReference {
  collection: string
  label: string
  id: number | string
  title: string
}

/** Sucht zählende Verweise auf eine Datei (höchstens 10 je Feld); Collections, die es noch nicht gibt, entfallen. */
export async function findUploadReferences(
  payload: Payload,
  target: UploadTarget,
  id: number | string,
  req?: PayloadRequest,
): Promise<FoundUploadReference[]> {
  const found: FoundUploadReference[] = []
  for (const ref of listUploadReferences(target)) {
    if (!payload.collections[ref.collection as 'users']) continue
    const match: Where = { [ref.path]: { equals: id } }
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

/** Deutsche Meldung für die Verwaltung. */
export function formatUploadReferenceMessage(refs: FoundUploadReference[]): string {
  const list = refs.map((r) => `${r.label} „${r.title}“`).join(', ')
  return `Die Datei wird noch verwendet und kann nicht gelöscht werden: ${list}.`
}
