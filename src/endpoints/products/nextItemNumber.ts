import type { Endpoint, PayloadRequest } from 'payload'

import { isAdminRequest } from '@/access'
import { preservingReq } from '@/lib/payload/localReq'
import {
  formatItemNumber,
  isReservedItemNumber,
  isValidItemNumber,
  suggestItemNumber,
} from '@/lib/products/itemNumber'

// Nummernvorschlag (E-12, DATENMODELL §6.6.4): `GET /api/products/next-item-number` (nur Verwaltung) und Live-Prüfung
// `GET /api/products/item-number-status?n=17[&exclude=<id>]` fürs Formular „Neues Stück“ (ARCHITEKTUR §2.5, PLAN P5.6):
// „✓ frei“ bzw. „✗ vergeben: Nr. 017 Schale mit Hund“; `exclude` = das gerade bearbeitete Stück selbst.

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

export type ItemNumberState = 'free' | 'taken' | 'reserved' | 'invalid'

export interface ItemNumberStatus {
  n: number | null
  status: ItemNumberState
  /** Text fürs Formular („✓ frei“, „✗ vergeben: Nr. 017 Schale mit Hund“). */
  message: string
  /** Bei `taken`: das Stück mit der Nummer. */
  product?: { id: number; itemNumber: number; title: string | null }
  /** Bei `taken`/`reserved`: nächste freie Nummer darüber. */
  nextFree?: number | null
}

/** Live-Prüfung einer Objektnummer (reine Abfrage, ändert nichts). */
export async function itemNumberStatus(
  req: PayloadRequest,
  raw: string | null | undefined,
  excludeId?: number | null,
): Promise<ItemNumberStatus> {
  const n = raw && /^\d{1,5}$/.test(raw.trim()) ? Number(raw.trim()) : null
  if (n === null || !isValidItemNumber(n)) {
    return { n: null, status: 'invalid', message: '✗ Bitte eine ganze Zahl von 1 bis 99 999.' }
  }
  const found = await preservingReq(req, () =>
    req.payload.find({
      collection: 'products',
      where: {
        and: [
          { itemNumber: { equals: n } },
          ...(excludeId ? [{ id: { not_equals: excludeId } }] : []),
        ],
      },
      limit: 1,
      depth: 0,
      locale: 'de',
      select: { itemNumber: true, title: true },
      overrideAccess: true,
      req,
    }),
  )
  const hit = found.docs[0] as { id: number; itemNumber: number; title?: string | null } | undefined
  if (hit) {
    const title = typeof hit.title === 'string' && hit.title.trim() ? hit.title.trim() : null
    return {
      n,
      status: 'taken',
      message: `✗ vergeben: ${formatItemNumber(n, 'de')}${title ? ` ${title}` : ''}`,
      product: { id: hit.id, itemNumber: hit.itemNumber, title },
      nextFree: await nextFreeItemNumber(req, n),
    }
  }
  if (isReservedItemNumber(n) && (await exampleDataPresent(req))) {
    return {
      n,
      status: 'reserved',
      message: '✗ Nr. 901–999 sind für Beispieldaten reserviert, bis sie entfernt sind.',
      nextFree: await nextFreeItemNumber(req, n),
    }
  }
  return { n, status: 'free', message: '✓ frei' }
}

export const itemNumberStatusEndpoint: Endpoint = {
  path: '/item-number-status',
  method: 'get',
  handler: async (req) => {
    if (!isAdminRequest(req)) {
      return Response.json({ error: 'Nicht erlaubt.' }, { status: 403 })
    }
    const url = new URL(req.url ?? 'http://localhost/')
    const exclude = Number(url.searchParams.get('exclude'))
    const result = await itemNumberStatus(
      req,
      url.searchParams.get('n'),
      Number.isSafeInteger(exclude) && exclude > 0 ? exclude : null,
    )
    return Response.json(result, { headers: { 'cache-control': 'private, no-store' } })
  },
}
