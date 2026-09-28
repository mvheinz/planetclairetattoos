import 'server-only'

import { cached } from '@/lib/cache/cached'
import { TAGS } from '@/lib/cache/tags'
import { LOCALES, type Locale, type ProductCategory } from '@/lib/enums'
import { getPublicPayload } from '@/lib/payload/public'
import type { Category } from '@/payload-types'

// Öffentliche Kategorien (DATENMODELL §6.5, KONZEPT §3.3): Slugs werden immer aus `categories` gelesen, nie im Code
// festgeschrieben. Gecacht über `cached()` (Tag `categories`, §9.3); `load…` = ungecacht.

export interface PublicCategory {
  id: number
  key: ProductCategory
  name: string
  slug: string
  intro: string | null
  sortOrder: number
  showInNavigation: boolean
  seo: { metaTitle: string | null; metaDescription: string | null }
}

export interface CategoryBySlug {
  category: PublicCategory
  /** Kanonischer Slug in der angefragten Sprache. */
  canonicalSlug: string
  /** `true`, wenn der Slug zur anderen Sprache gehört → 308 auf `canonicalSlug` (KONZEPT §2.4). */
  redirect: boolean
}

function toPublicCategory(doc: Category): PublicCategory {
  return {
    id: doc.id,
    key: doc.key,
    name: doc.name,
    slug: doc.slug,
    intro: doc.intro ?? null,
    sortOrder: doc.sortOrder,
    showInNavigation: doc.showInNavigation === true,
    seo: {
      metaTitle: doc.seo?.metaTitle ?? null,
      metaDescription: doc.seo?.metaDescription ?? null,
    },
  }
}

async function findBySlug(slug: string, locale: Locale): Promise<Category | null> {
  const payload = await getPublicPayload()
  const res = await payload.find({
    collection: 'categories',
    where: { slug: { equals: slug } },
    locale,
    depth: 0,
    limit: 1,
    pagination: false,
  })
  return res.docs[0] ?? null
}

async function findById(id: number, locale: Locale): Promise<Category | null> {
  const payload = await getPublicPayload()
  const res = await payload.find({
    collection: 'categories',
    where: { id: { equals: id } },
    locale,
    fallbackLocale: 'de',
    depth: 0,
    limit: 1,
    pagination: false,
  })
  return res.docs[0] ?? null
}

/**
 * Kategorie zum Slug der Seiten-Sprache; passt der Slug nur in der anderen Sprache, kommt dieselbe Kategorie mit
 * `redirect: true` und dem richtigen Slug zurück. Unbekannt → `null` (404).
 */
export async function loadCategoryBySlug(
  locale: Locale,
  slug: string,
): Promise<CategoryBySlug | null> {
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return null
  const own = await findBySlug(slug, locale)
  if (own) {
    const category = toPublicCategory(own)
    return { category, canonicalSlug: category.slug, redirect: false }
  }
  for (const other of LOCALES.filter((l) => l !== locale)) {
    const hit = await findBySlug(slug, other)
    if (!hit) continue
    const doc = await findById(hit.id, locale)
    if (!doc) continue
    const category = toPublicCategory(doc)
    return { category, canonicalSlug: category.slug, redirect: true }
  }
  return null
}

/** Kategorien mit `showInNavigation`, nach `sortOrder` (Menü, Filter-Chips). */
export async function loadNavCategories(locale: Locale): Promise<PublicCategory[]> {
  const payload = await getPublicPayload()
  const res = await payload.find({
    collection: 'categories',
    where: { showInNavigation: { equals: true } },
    sort: 'sortOrder',
    locale,
    fallbackLocale: 'de',
    depth: 0,
    limit: 20,
    pagination: false,
  })
  return res.docs.filter((c) => c.slug && c.name).map(toPublicCategory)
}

export const getCategoryBySlug = cached(loadCategoryBySlug, {
  key: 'category-by-slug',
  tags: [TAGS.categories],
})

export const listNavCategories = cached(loadNavCategories, {
  key: 'nav-categories',
  tags: [TAGS.categories],
})
