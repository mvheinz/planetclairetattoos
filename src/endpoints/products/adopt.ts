import type { PayloadRequest } from 'payload'

import { TransitionError } from '@/lib/commerce/transitionError'
import { writeAudit } from '@/lib/audit'
import { inTransaction } from '@/lib/payload/transaction'
import { preservingReq } from '@/lib/payload/localReq'

import { productAction } from './actions'

// „Übernehmen“ (DATENMODELL §13.4): ein Seed-Stück wird zu einem echten (`seed = false`), referenzierte Bilder mit;
// Nummer und `seedKey` bleiben. Audit `product_adopted`.
export async function adoptProduct(req: PayloadRequest, id: number) {
  return inTransaction(req, async () => {
    const doc = await preservingReq(req, () =>
      req.payload.findByID({ collection: 'products', id, depth: 0, overrideAccess: true, req }),
    )
    if (doc.seed !== true) throw new TransitionError('Das Stück ist schon übernommen.')
    for (const image of doc.images ?? []) {
      const mediaId = typeof image === 'object' ? image.id : image
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
    }
    const adopted = await preservingReq(req, () =>
      req.payload.update({
        collection: 'products',
        id,
        data: { seed: false } as never,
        depth: 0,
        overrideAccess: true,
        req,
      }),
    )
    await writeAudit(req, {
      action: 'product_adopted',
      entityCollection: 'products',
      entityId: id,
      summary: `${adopted.adminTitle ?? `Stück ${id}`} übernommen`,
    })
    return adopted
  })
}

export const adoptEndpoint = productAction('adopt', (req, id) => adoptProduct(req, id))
