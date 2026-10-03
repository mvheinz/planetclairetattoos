import 'server-only'

import type { FlattenedField, PayloadRequest } from 'payload'

import { writeAudit } from '@/lib/audit'
import { TransitionError } from '@/lib/commerce/transitionError'
import { inTransaction } from '@/lib/payload/transaction'
import { preservingReq } from '@/lib/payload/localReq'

import { referencedIds } from './references'

// „Übernehmen“ (DATENMODELL §13.4, PLAN P8.19): ein Beispiel-Dokument aus `products`, `flash`, `tattoo-gallery` oder
// `media` wird zu einem echten (`seed = false`); Medien, auf die es verweist (Bilder, Blöcke …), werden mit übernommen.
// Nummer und `seedKey` bleiben (ein erneuter Seed-Lauf überspringt übernommene Dokumente, SEED-SPEC §1.3). Audit
// `product_adopted` (einzige Übernahme-Aktion laut DATENMODELL §13.4). Bei `tattoo-gallery` bleibt der Eintrag ohne
// echte Einwilligung unveröffentlicht (Regel der Galerie selbst). Ein zweites Mal → 409.

export const ADOPTABLE_COLLECTIONS = ['products', 'flash', 'tattoo-gallery', 'media'] as const
export type AdoptableCollection = (typeof ADOPTABLE_COLLECTIONS)[number]

export const isAdoptable = (v: unknown): v is AdoptableCollection =>
  (ADOPTABLE_COLLECTIONS as readonly unknown[]).includes(v)

const LABEL: Record<AdoptableCollection, string> = {
  products: 'Stück',
  flash: 'Flash',
  'tattoo-gallery': 'Galerie-Eintrag',
  media: 'Bild',
}

function titleOf(collection: AdoptableCollection, doc: Record<string, unknown>): string {
  const t =
    collection === 'products'
      ? doc.adminTitle
      : collection === 'flash'
        ? (doc.title ?? doc.number)
        : collection === 'media'
          ? doc.filename
          : doc.caption
  return typeof t === 'string' || typeof t === 'number'
    ? `${LABEL[collection]} ${t}`
    : `${LABEL[collection]} ${String(doc.id)}`
}

export interface AdoptResult {
  doc: Record<string, unknown>
  /** Mit übernommene Seed-Medien. */
  media: number
}

export async function adoptSeedDocument(
  req: PayloadRequest,
  collection: AdoptableCollection,
  id: number,
): Promise<AdoptResult> {
  return inTransaction(req, async () => {
    const doc = (await preservingReq(req, () =>
      req.payload.findByID({ collection, id, depth: 0, overrideAccess: true, req }),
    )) as unknown as Record<string, unknown>
    if (doc.seed !== true) {
      throw new TransitionError(
        collection === 'products'
          ? 'Das Stück ist schon übernommen.'
          : 'Dieser Eintrag ist schon übernommen.',
      )
    }
    let media = 0
    if (collection !== 'media') {
      const fields = req.payload.collections[collection].config.flattenedFields as FlattenedField[]
      for (const mediaId of referencedIds(req.payload, fields, doc, 'media')) {
        const m = await preservingReq(req, () =>
          req.payload.findByID({
            collection: 'media',
            id: mediaId,
            depth: 0,
            overrideAccess: true,
            disableErrors: true,
            req,
          }),
        )
        if (!m || m.seed !== true) continue
        await preservingReq(req, () =>
          req.payload.update({
            collection: 'media',
            id: mediaId,
            data: { seed: false } as never,
            depth: 0,
            overrideAccess: true,
            req,
          }),
        )
        media++
      }
    }
    const adopted = (await preservingReq(req, () =>
      req.payload.update({
        collection,
        id,
        data: { seed: false } as never,
        depth: 0,
        overrideAccess: true,
        req,
      }),
    )) as unknown as Record<string, unknown>
    await writeAudit(req, {
      action: 'product_adopted',
      entityCollection: collection,
      entityId: id,
      summary: `${titleOf(collection, adopted)} übernommen${media > 0 ? ` (mit ${media} Bild${media === 1 ? '' : 'ern'})` : ''}`,
    })
    return { doc: adopted, media }
  })
}
