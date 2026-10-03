import type { PayloadRequest } from 'payload'

import { adoptSeedDocument } from '@/lib/seed/adopt'

import { productAction } from './actions'

// „Übernehmen“ (DATENMODELL §13.4): ein Seed-Stück wird zu einem echten (`seed = false`), referenzierte Bilder mit;
// Nummer und `seedKey` bleiben. Audit `product_adopted`. Gemeinsame Logik mit Flash/Galerie/Medien: `@/lib/seed/adopt`.
export async function adoptProduct(req: PayloadRequest, id: number) {
  return (await adoptSeedDocument(req, 'products', id)).doc
}

export const adoptEndpoint = productAction('adopt', (req, id) => adoptProduct(req, id))
