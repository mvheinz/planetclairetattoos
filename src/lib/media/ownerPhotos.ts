import 'server-only'

import type { Payload } from 'payload'

// Startklar-Punkt „Fotos von Jutta ohne Freigabe“ (R-181, PLAN P8.20, vorgemerkt für P10.14 – `STARTKLAR_PLANNED`):
// Anzahl der Bilder mit `showsPerson = jutta` ohne Häkchen `ownerApproved`. Solche Bilder sind öffentlich nie abrufbar
// (`isMediaPubliclyVisible`, Lese-Zugriff `media`), die Startklar-Prüfung macht sie trotzdem sichtbar.
export async function countUnapprovedOwnerPhotos(payload: Payload): Promise<number> {
  const { totalDocs } = await payload.count({
    collection: 'media',
    where: {
      and: [{ showsPerson: { equals: 'jutta' } }, { ownerApproved: { not_equals: true } }],
    },
    overrideAccess: true,
  })
  return totalDocs
}
