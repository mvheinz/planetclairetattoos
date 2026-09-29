import 'server-only'

import type { PayloadRequest, Where } from 'payload'

import {
  evaluateProductTransition,
  loadProductTransitionFacts,
  type ProductTransition,
} from '@/lib/commerce/productTransitions'
import {
  PRODUCT_CATEGORIES,
  PRODUCT_STATUSES,
  type ProductCategory,
  type ProductStatus,
  type ReservationSource,
  type SoldChannel,
} from '@/lib/enums'
import { formatBerlin } from '@/lib/time'

// „Meine Stücke“ (PLAN P5.8, KONZEPT §7.5): Suche nach Nummer (exakt) oder Titel (enthält), Filter Status und Kategorie,
// seitenweise 20 Karten. Je Karte die Angaben der Liste und die Knöpfe, die im aktuellen Status möglich sind
// (Vorbedingungen aus dem Statusautomaten, `evaluateProductTransition`).

export const PIECES_PAGE_SIZE = 20

export interface PiecesQuery {
  q: string
  status: ProductStatus | null
  category: ProductCategory | null
  page: number
}

type Params = Record<string, string | string[] | undefined> | undefined

const one = (v: string | string[] | undefined): string =>
  (Array.isArray(v) ? v[0] : v)?.trim() ?? ''

export function parsePiecesQuery(params: Params): PiecesQuery {
  const status = one(params?.status)
  const category = one(params?.category)
  const page = Number(one(params?.page))
  return {
    q: one(params?.q).slice(0, 80),
    status: (PRODUCT_STATUSES as readonly string[]).includes(status)
      ? (status as ProductStatus)
      : null,
    category: (PRODUCT_CATEGORIES as readonly string[]).includes(category)
      ? (category as ProductCategory)
      : null,
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  }
}

/** Suchbedingung: nur Ziffern → Nummer exakt („017“ = Nr. 17), sonst Titel enthält. */
export function piecesWhere(query: Pick<PiecesQuery, 'q' | 'status' | 'category'>): Where {
  const and: Where[] = []
  const q = query.q.trim()
  if (/^\d{1,5}$/.test(q)) and.push({ itemNumber: { equals: Number(q) } })
  else if (q) and.push({ title: { like: q } })
  if (query.status) and.push({ status: { equals: query.status } })
  if (query.category) and.push({ category: { equals: query.category } })
  return and.length ? { and } : {}
}

export type PieceAction =
  | 'edit'
  | 'publish'
  | 'unpublish'
  | 'archive'
  | 'delete'
  | 'copyLink'
  | 'sellOffline'
  | 'sellOfflineReserved'
  | 'toOrder'
  | 'toggleArchive'
  | 'returnToStock'
  | 'archiveAfterReturn'
  | 'restore'

export interface PieceCard {
  id: number
  itemNumber: number
  title: string | null
  category: ProductCategory
  priceCents: number
  status: ProductStatus
  slug: string | null
  thumbUrl: string | null
  showInArchiveAfterSale: boolean
  soldChannel: SoldChannel | null
  /** „reserviert bis 14:35“ bzw. „Vorkasse PC-2026-00017 bis 03.10.2026“. */
  reservationText: string | null
  reservationSource: ReservationSource | null
  orderId: number | null
  actions: PieceAction[]
}

export interface PiecesResult {
  cards: PieceCard[]
  totalDocs: number
  page: number
  totalPages: number
}

type Doc = Record<string, unknown>

const idOf = (v: unknown): number | null => {
  const raw = v && typeof v === 'object' ? (v as { id?: unknown }).id : v
  const n = Number(raw)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

const allowed = (
  status: ProductStatus,
  transition: ProductTransition,
  facts: Parameters<typeof evaluateProductTransition>[2],
  input: Parameters<typeof evaluateProductTransition>[3] = {},
) => evaluateProductTransition(status, transition, facts, input).ok

async function thumbOf(req: PayloadRequest, images: unknown): Promise<string | null> {
  const first = Array.isArray(images) ? images[0] : null
  if (!first) return null
  const media =
    first && typeof first === 'object'
      ? (first as Doc)
      : ((await req.payload.findByID({
          collection: 'media',
          id: Number(first),
          depth: 0,
          overrideAccess: true,
          disableErrors: true,
        })) as Doc | null)
  if (!media) return null
  const sizes = (media.sizes ?? {}) as { thumb?: { url?: string | null } | null }
  return sizes.thumb?.url ?? (media.url as string | null) ?? null
}

async function reservationInfo(
  req: PayloadRequest,
  product: Doc,
): Promise<{ text: string | null; source: ReservationSource | null }> {
  const res = await req.payload.find({
    collection: 'reservations',
    where: { and: [{ product: { equals: product.id } }, { status: { equals: 'active' } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const r = res.docs[0] as Doc | undefined
  const source = (r?.source as ReservationSource | undefined) ?? null
  const orderId = idOf(product.currentOrder) ?? idOf(r?.order)
  if (source === 'prepayment' && orderId) {
    const order = (await req.payload.findByID({
      collection: 'orders',
      id: orderId,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
    })) as Doc | null
    const due = (order?.prepayment as Doc | undefined)?.dueAt ?? product.reservedUntil
    return {
      source,
      text: `Vorkasse ${String(order?.orderNumber ?? '')} bis ${
        typeof due === 'string' ? formatBerlin(new Date(due), 'dd.MM.yyyy') : '–'
      }`,
    }
  }
  const until = product.reservedUntil ?? r?.expiresAt
  return {
    source,
    text:
      typeof until === 'string'
        ? `reserviert bis ${formatBerlin(new Date(until), 'HH:mm')}`
        : 'reserviert',
  }
}

async function cardOf(req: PayloadRequest, doc: Doc): Promise<PieceCard> {
  const status = doc.status as ProductStatus
  const actions: PieceAction[] = ['edit']
  let reservationText: string | null = null
  let reservationSource: ReservationSource | null = null
  const orderId = idOf(doc.currentOrder)
  const base = { actor: 'admin' as const }
  switch (status) {
    case 'draft':
      actions.push('publish', 'archive')
      if (!doc.firstPublishedAt) actions.push('delete')
      break
    case 'available':
      actions.push('copyLink', 'sellOffline', 'unpublish', 'archive')
      break
    case 'reserved': {
      const info = await reservationInfo(req, doc)
      reservationText = info.text
      reservationSource = info.source
      if (info.source === 'checkout_session') actions.push('sellOfflineReserved')
      if (info.source === 'prepayment' && orderId) actions.push('toOrder')
      break
    }
    case 'sold': {
      const facts = await loadProductTransitionFacts(req, doc, 'admin')
      actions.push('toggleArchive')
      if (allowed(status, 'returnToStock', facts)) actions.push('returnToStock')
      if (allowed(status, 'archiveAfterReturn', facts)) actions.push('archiveAfterReturn')
      if (doc.soldChannel !== 'offline' && orderId) actions.push('toOrder')
      if (doc.showInArchiveAfterSale === true) actions.push('copyLink')
      break
    }
    case 'archived':
      if (allowed(status, 'restore', base)) actions.push('restore')
      break
  }
  return {
    id: Number(doc.id),
    itemNumber: Number(doc.itemNumber),
    title: typeof doc.title === 'string' ? doc.title : null,
    category: doc.category as ProductCategory,
    priceCents: Number(doc.priceCents ?? 0),
    status,
    slug: typeof doc.slug === 'string' ? doc.slug : null,
    thumbUrl: await thumbOf(req, doc.images),
    showInArchiveAfterSale: doc.showInArchiveAfterSale === true,
    soldChannel: (doc.soldChannel as SoldChannel | null) ?? null,
    reservationText,
    reservationSource,
    orderId,
    actions,
  }
}

/** Eine Seite „Meine Stücke“ (neueste Änderung zuerst). */
export async function queryPieces(req: PayloadRequest, query: PiecesQuery): Promise<PiecesResult> {
  const result = await req.payload.find({
    collection: 'products',
    where: piecesWhere(query),
    locale: 'de',
    fallbackLocale: false,
    depth: 1,
    populate: { media: { url: true, sizes: true } } as never,
    limit: PIECES_PAGE_SIZE,
    page: query.page,
    sort: '-updatedAt',
    overrideAccess: true,
  })
  const cards: PieceCard[] = []
  for (const doc of result.docs) cards.push(await cardOf(req, doc as unknown as Doc))
  return {
    cards,
    totalDocs: result.totalDocs,
    page: result.page ?? query.page,
    totalPages: result.totalPages,
  }
}
