import 'server-only'

import type { Where } from 'payload'

import { cached } from '@/lib/cache/cached'
import { TAGS } from '@/lib/cache/tags'
import type { Locale, ProductCategory } from '@/lib/enums'
import { getPublicPayload } from '@/lib/payload/public'
import type { Product } from '@/payload-types'

// Öffentliche Shop-Datenschicht (ARCHITEKTUR §9.2, KONZEPT §3.2–§3.5): nur über `getPublicPayload()` – der Zugriff der
// Collection liefert ohnehin nur `available`, `reserved` und `sold` mit Archiv, bei SEED_PREVIEW_MODE ≠ true ohne
// Seed-Stücke (DATENMODELL §1.4, §6.6). Jede Funktion ist über `cached()` zwischengespeichert (Tag `products`, §9.3).
// Die `load…`-Varianten sind die ungecachten Funktionen (für Tests und `generateStaticParams`).

/** 24 Stücke je Seite (KONZEPT §3.2). */
export const SHOP_PAGE_SIZE = 24

/** Interne Felder, die keine öffentliche Antwort enthalten darf (Feldzugriff `adminField` + Abwehr in der Tiefe). */
export const PRODUCT_ADMIN_FIELDS = [
  'reservationRef',
  'currentOrder',
  'internalNote',
  'storageLocation',
  'nickelEvidence',
  'customs',
  'offlineSaleNote',
  'i18n',
  'adminAttention',
] as const

export type PublicProduct = Omit<Product, (typeof PRODUCT_ADMIN_FIELDS)[number]>

export interface ProductPage {
  docs: PublicProduct[]
  page: number
  pageSize: number
  totalDocs: number
  totalPages: number
  hasNextPage: boolean
}

const VISIBLE_UNSOLD: Where = { status: { in: ['available', 'reserved'] } }
const ARCHIVED_SOLD: Where = {
  and: [{ status: { equals: 'sold' } }, { showInArchiveAfterSale: { equals: true } }],
}

/** Entfernt interne Felder (auch wenn der Feldzugriff sie schon ausblendet). */
export function toPublicProduct(doc: Product): PublicProduct {
  const out: Record<string, unknown> = { ...doc }
  for (const field of PRODUCT_ADMIN_FIELDS) delete out[field]
  return out as PublicProduct
}

const normalizePage = (page: number | undefined) =>
  Number.isInteger(page) && (page as number) >= 1 ? (page as number) : 1

function pageOf(docs: PublicProduct[], page: number, totalDocs: number): ProductPage {
  const totalPages = Math.max(1, Math.ceil(totalDocs / SHOP_PAGE_SIZE))
  return {
    docs,
    page,
    pageSize: SHOP_PAGE_SIZE,
    totalDocs,
    totalPages,
    hasNextPage: page < totalPages,
  }
}

const withCategories = (where: Where, keys?: readonly string[]): Where =>
  keys?.length ? { and: [where, { category: { in: [...keys] } }] } : where

async function sortedIds(where: Where, sort: string[]): Promise<number[]> {
  const payload = await getPublicPayload()
  const res = await payload.find({
    collection: 'products',
    where,
    sort,
    depth: 0,
    pagination: false,
    select: { itemNumber: true },
  })
  return res.docs.map((d) => d.id)
}

async function byIds(ids: number[], locale: Locale): Promise<PublicProduct[]> {
  if (ids.length === 0) return []
  const payload = await getPublicPayload()
  const res = await payload.find({
    collection: 'products',
    where: { id: { in: ids } },
    locale,
    fallbackLocale: 'de',
    depth: 1,
    pagination: false,
  })
  const byId = new Map(res.docs.map((d) => [d.id, d]))
  return ids.flatMap((id) => {
    const doc = byId.get(id)
    return doc ? [toPublicProduct(doc)] : []
  })
}

export interface ShopListQuery {
  locale: Locale
  categoryKeys?: readonly ProductCategory[]
  /** Nur nicht verkaufte Stücke (`?available=1`, AK-3-03). */
  availableOnly?: boolean
  page?: number
}

/**
 * Shop-Liste R02/R03 (KONZEPT §3.2): zuerst `available` und `reserved` nach `firstPublishedAt` absteigend, danach
 * `sold` mit `showInArchiveAfterSale` nach `soldAt` absteigend; `availableOnly` ohne `sold`. 24 je Seite.
 */
export async function loadShopProducts(query: ShopListQuery): Promise<ProductPage> {
  const page = normalizePage(query.page)
  const [unsold, sold] = await Promise.all([
    sortedIds(withCategories(VISIBLE_UNSOLD, query.categoryKeys), ['-firstPublishedAt', '-id']),
    query.availableOnly
      ? Promise.resolve([])
      : sortedIds(withCategories(ARCHIVED_SOLD, query.categoryKeys), ['-soldAt', '-id']),
  ])
  const all = [...unsold, ...sold]
  const start = (page - 1) * SHOP_PAGE_SIZE
  const docs = await byIds(all.slice(start, start + SHOP_PAGE_SIZE), query.locale)
  return pageOf(docs, page, all.length)
}

export interface ArchiveListQuery {
  locale: Locale
  categoryKey?: ProductCategory
  page?: number
}

/** Archiv R05 (KONZEPT §3.5, AK-3-09): nur `sold` mit `showInArchiveAfterSale`, nach `soldAt` absteigend. */
export async function loadArchiveProducts(query: ArchiveListQuery): Promise<ProductPage> {
  const page = normalizePage(query.page)
  const ids = await sortedIds(
    withCategories(ARCHIVED_SOLD, query.categoryKey ? [query.categoryKey] : undefined),
    ['-soldAt', '-id'],
  )
  const start = (page - 1) * SHOP_PAGE_SIZE
  const docs = await byIds(ids.slice(start, start + SHOP_PAGE_SIZE), query.locale)
  return pageOf(docs, page, ids.length)
}

/** Kategorien, in denen es Archiv-Stücke gibt (Archiv-Chips R05, KONZEPT §3.5). */
export async function loadArchiveCategoryKeys(): Promise<ProductCategory[]> {
  const payload = await getPublicPayload()
  const res = await payload.find({
    collection: 'products',
    where: ARCHIVED_SOLD,
    depth: 0,
    pagination: false,
    select: { category: true },
  })
  return [...new Set(res.docs.map((d) => d.category))]
}

/** Öffentliches Stück zur Objektnummer (R04, R31); nicht öffentlich oder unbekannt → `null`. */
export async function loadPublicProductByItemNumber(
  itemNumber: number,
  locale: Locale,
): Promise<PublicProduct | null> {
  if (!Number.isInteger(itemNumber) || itemNumber < 1) return null
  const payload = await getPublicPayload()
  const res = await payload.find({
    collection: 'products',
    where: { itemNumber: { equals: itemNumber } },
    locale,
    fallbackLocale: 'de',
    depth: 1,
    limit: 1,
    pagination: false,
  })
  const doc = res.docs[0]
  return doc ? toPublicProduct(doc) : null
}

/** Bis zu `limit` sichtbare, nicht verkaufte Stücke der Kategorien, neueste zuerst (ohne `excludeId`). */
async function loadUnsold(
  categoryKeys: readonly string[],
  limit: number,
  locale: Locale,
  excludeId?: number,
): Promise<PublicProduct[]> {
  if (categoryKeys.length === 0 || limit < 1) return []
  const payload = await getPublicPayload()
  const clauses: Where[] = [VISIBLE_UNSOLD, { category: { in: [...categoryKeys] } }]
  if (excludeId !== undefined) clauses.push({ id: { not_equals: excludeId } })
  const res = await payload.find({
    collection: 'products',
    where: { and: clauses },
    sort: ['-firstPublishedAt', '-id'],
    locale,
    fallbackLocale: 'de',
    depth: 1,
    limit,
    pagination: false,
  })
  return res.docs.map(toPublicProduct)
}

/** „Mehr aus {Kategorie}“ (KONZEPT §3.4 Nr. 11): andere sichtbare, nicht verkaufte Stücke derselben Kategorie. */
export function loadRelatedProducts(
  product: Pick<PublicProduct, 'id' | 'category'>,
  limit = 4,
  locale: Locale = 'de',
): Promise<PublicProduct[]> {
  return loadUnsold([product.category], limit, locale, product.id)
}

/** Stücke für die Kategorie-Stationen der Startseite (KO-21): `available`/`reserved`, neueste zuerst. */
export function loadStationProducts(
  categoryKeys: readonly ProductCategory[],
  limit = 4,
  locale: Locale = 'de',
): Promise<PublicProduct[]> {
  return loadUnsold(categoryKeys, limit, locale)
}

// --- gecachte Lesefunktionen (§9.2) ------------------------------------------------------------------------------

const productTags = [TAGS.products] as const

export const listShopProducts = cached(loadShopProducts, {
  key: 'shop-products',
  tags: ([q]) => [TAGS.products, ...(q.categoryKeys ?? []).map((k) => TAGS.category(k))],
})

export const listArchiveProducts = cached(loadArchiveProducts, {
  key: 'archive-products',
  tags: ([q]) => [TAGS.products, ...(q.categoryKey ? [TAGS.category(q.categoryKey)] : [])],
})

export const listArchiveCategoryKeys = cached(loadArchiveCategoryKeys, {
  key: 'archive-category-keys',
  tags: [TAGS.products],
})

export const getPublicProductByItemNumber = cached(loadPublicProductByItemNumber, {
  key: 'public-product',
  tags: productTags,
})

const cachedRelated = cached(loadRelatedProducts, {
  key: 'related-products',
  tags: ([p]) => [TAGS.products, TAGS.product(p.id), TAGS.category(p.category)],
})

/** Gecacht; Schlüssel nur aus `id` und `category` (nicht das ganze Stück). */
export const listRelatedProducts = (
  product: Pick<PublicProduct, 'id' | 'category'>,
  limit = 4,
  locale: Locale = 'de',
): Promise<PublicProduct[]> =>
  cachedRelated({ id: product.id, category: product.category }, limit, locale)

export const listStationProducts = cached(loadStationProducts, {
  key: 'station-products',
  tags: ([keys]) => [TAGS.products, TAGS.home, ...keys.map((k) => TAGS.category(k))],
})
