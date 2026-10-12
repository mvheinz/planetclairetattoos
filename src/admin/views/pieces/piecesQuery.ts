import 'server-only'

import type { PayloadRequest, Where } from 'payload'

import {
  evaluateProductTransition,
  loadProductTransitionFacts,
  type ProductTransition,
} from '@/lib/commerce/productTransitions'
import { ENUM_LABELS } from '@/lib/enumLabels'
import {
  PRODUCT_CATEGORIES,
  PRODUCT_STATUSES,
  type AttentionReason,
  type ProductCategory,
  type ProductStatus,
  type ReservationSource,
  type SoldChannel,
} from '@/lib/enums'
import { loadDraftViews, readinessFor } from '@/lib/products/publishReadiness'
import type { Readiness } from '@/lib/products/readiness'
import { formatBerlin } from '@/lib/time'

// „Meine Stücke“ (PLAN P5.8, KONZEPT §7.5): Suche nach Nummer (exakt) oder Titel (enthält), Filter Status, Kategorie
// und „zu prüfen“ (V-31: rote Markierung „von Hand“, z. B. aus dem Bestands-Import), seitenweise 20 Karten. Je Karte
// die Angaben der Liste, bei Entwürfen „fertig“ bzw. „fehlt: …“ (V-32, dieselbe Prüfung wie beim Online-Stellen) und
// die Knöpfe, die im aktuellen Status möglich sind (Vorbedingungen aus dem Statusautomaten,
// `evaluateProductTransition`).

export const PIECES_PAGE_SIZE = 20

export interface PiecesQuery {
  q: string
  status: ProductStatus | null
  category: ProductCategory | null
  /** V-31: nur Stücke mit Markierung „zu prüfen“ (`adminAttention` mit Grund „von Hand“). */
  review: boolean
  page: number
}

/** Bedingung „zu prüfen“ (V-31) – dieselbe zählt der gelbe Sammelhinweis unter „Heute“. */
export const REVIEW_WHERE: Where = {
  and: [
    { 'adminAttention.flag': { equals: true } },
    { 'adminAttention.reason': { equals: 'manual' } },
  ],
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
    review: one(params?.pruefen) === '1',
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  }
}

/** Suchbedingung: nur Ziffern → Nummer exakt („017“ = Nr. 17), sonst Titel enthält. */
export function piecesWhere(
  query: Pick<PiecesQuery, 'q' | 'status' | 'category'> & { review?: boolean },
): Where {
  const and: Where[] = []
  const q = query.q.trim()
  if (/^\d{1,5}$/.test(q)) and.push({ itemNumber: { equals: Number(q) } })
  else if (q) and.push({ title: { like: q } })
  if (query.status) and.push({ status: { equals: query.status } })
  if (query.category) and.push({ category: { equals: query.category } })
  if (query.review) and.push(REVIEW_WHERE)
  return and.length ? { and } : {}
}

/**
 * Knöpfe einer Karte. V-34: „Aus dem Shop nehmen“ (`takeOff`, online) fragt „Kommt es wieder?“ – Ja = P3 zurück zum
 * Entwurf, Nein = P12 weglegen (ausgeblendet). `archive` (Entwurf) und `archiveAfterReturn` (P13) heißen „Weglegen“.
 * `offlinePrice`: erzielten Markt-Preis nachtragen (V-33 a).
 */
export type PieceAction =
  | 'edit'
  | 'publish'
  | 'takeOff'
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
  | 'offlinePrice'

/** Markierung „Hinweis für dich“ an der Karte (V-31); `manual` = „zu prüfen“, mit Knopf „Erledigt“. */
export interface PieceAttention {
  reason: AttentionReason | null
  label: string
  note: string | null
  manual: boolean
}

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
  /** Erzielter Markt-Preis (nur Markt-/Privatverkauf). */
  offlineSalePriceCents: number | null
  attention: PieceAttention | null
  /** Nur Entwürfe: „fertig“ bzw. „fehlt: …“ (V-32). */
  readiness: Readiness | null
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

/** Markierung aus `adminAttention` (nur mit gesetztem Häkchen). */
export function attentionOf(value: unknown): PieceAttention | null {
  const a = (value ?? null) as { flag?: unknown; reason?: unknown; note?: unknown } | null
  if (!a || a.flag !== true) return null
  const reason =
    typeof a.reason === 'string' && a.reason in ENUM_LABELS.ATTENTION_REASONS
      ? (a.reason as AttentionReason)
      : null
  return {
    reason,
    label: reason === 'manual' || !reason ? 'zu prüfen' : ENUM_LABELS.ATTENTION_REASONS[reason].de,
    note: typeof a.note === 'string' && a.note.trim() ? a.note.trim() : null,
    manual: reason === 'manual',
  }
}

async function cardOf(
  req: PayloadRequest,
  doc: Doc,
  readiness: Map<number, Readiness>,
): Promise<PieceCard> {
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
      actions.push('copyLink', 'sellOffline', 'takeOff')
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
      if (doc.soldChannel === 'offline') actions.push('offlinePrice')
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
    offlineSalePriceCents:
      typeof doc.offlineSalePriceCents === 'number' ? doc.offlineSalePriceCents : null,
    attention: attentionOf(doc.adminAttention),
    readiness: status === 'draft' ? (readiness.get(Number(doc.id)) ?? null) : null,
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
  // V-32: „was fehlt noch?“ für die Entwürfe dieser Seite, gebündelt (alle Sprachen, wie beim Online-Stellen).
  const draftIds = result.docs.filter((d) => d.status === 'draft').map((d) => d.id)
  const readiness =
    draftIds.length > 0
      ? await readinessFor(req, await loadDraftViews(req, { id: { in: draftIds } }))
      : new Map<number, Readiness>()
  const cards: PieceCard[] = []
  for (const doc of result.docs) cards.push(await cardOf(req, doc as unknown as Doc, readiness))
  return {
    cards,
    totalDocs: result.totalDocs,
    page: result.page ?? query.page,
    totalPages: result.totalPages,
  }
}
