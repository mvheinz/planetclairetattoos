import type { Endpoint, PayloadRequest } from 'payload'

import { isAdminRequest } from '@/access'
import { preservingReq } from '@/lib/payload/localReq'
import { suggestItemNumber } from '@/lib/products/itemNumber'

// Nummernvorschlag (E-12, DATENMODELL §6.6.4): `GET /api/products/next-item-number` (nur Verwaltung).

/** `settings.seed.exampleDataPresent` (ohne Global: `false`). */
export async function exampleDataPresent(req: PayloadRequest): Promise<boolean> {
  if (!req.payload.config.globals.some((g) => g.slug === 'settings')) return false
  const settings = await preservingReq(req, () =>
    req.payload.findGlobal({ slug: 'settings', req, depth: 0, overrideAccess: true }),
  )
  return settings.seed?.exampleDataPresent === true
}

type Find = (
  where: object,
  sort?: string,
  limit?: number,
) => Promise<{ docs: { itemNumber: number }[] }>

function finder(req: PayloadRequest): Find {
  return (where, sort, limit = 1) =>
    preservingReq(req, () =>
      req.payload.find({
        collection: 'products',
        where: where as never,
        sort,
        limit,
        pagination: limit > 0,
        depth: 0,
        select: { itemNumber: true },
        overrideAccess: true,
        req,
      }),
    )
}

/** Nächste freie (und nicht gesperrte) Nummer oberhalb von `after`. */
export async function nextFreeItemNumber(
  req: PayloadRequest,
  after: number | null,
): Promise<number | null> {
  const find = finder(req)
  const higher = await find({ itemNumber: { greater_than: after ?? 0 } }, 'itemNumber', 0)
  const taken = new Set(higher.docs.map((d) => d.itemNumber))
  return suggestItemNumber({
    maxReal: after,
    taken,
    exampleDataPresent: await exampleDataPresent(req),
  })
}

/** Vorschlag = max(Nicht-Seed) + 1; belegte und (bei Beispieldaten) gesperrte Nummern werden übersprungen. */
export async function computeNextItemNumber(req: PayloadRequest): Promise<number | null> {
  const top = await finder(req)({ seed: { not_equals: true } }, '-itemNumber')
  return nextFreeItemNumber(req, top.docs[0]?.itemNumber ?? null)
}

export const nextItemNumberEndpoint: Endpoint = {
  path: '/next-item-number',
  method: 'get',
  handler: async (req) => {
    if (!isAdminRequest(req)) {
      return Response.json({ error: 'Nicht erlaubt.' }, { status: 403 })
    }
    const suggestion = await computeNextItemNumber(req)
    return Response.json({ suggestion }, { headers: { 'cache-control': 'private, no-store' } })
  },
}
