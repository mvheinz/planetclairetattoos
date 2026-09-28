import 'server-only'

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound, permanentRedirect } from 'next/navigation'

import { getCategoryBySlug, loadAllCategories, type PublicCategory } from '@/lib/data/categories'
import { getPublicPage } from '@/lib/data/pages'
import { loadArchiveCategoryKeys, loadArchiveProducts, loadShopProducts } from '@/lib/data/products'
import { createLogger } from '@/lib/monitoring/logger'
import { isLocale, localizedPath } from '@/lib/routes/paths'
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@/lib/routes/registry'
import { buildListMetadata } from '@/lib/seo/metadata'
import { listSearch, parseVariantKey, variantKey, type ListParams } from '@/lib/shop/listParams'

// Gemeinsame Routen-Logik der Listen R02, R03, R05 (Grundform und statische Varianten aus Spike B-05): Sprache,
// Varianten-Schlüssel, Kategorie-Auflösung (unbekannt → 404, Slug der anderen Sprache → 308), Metadaten und die beim
// Build vorgerenderten Varianten. Ohne Datenbank beim Build entstehen die Varianten beim ersten Aufruf (ISR).

const log = createLogger()

export const toLocale = (value: string): Locale => (isLocale(value) ? value : DEFAULT_LOCALE)

/** Parameter aus dem Varianten-Segment; nicht kanonischer Schlüssel → 404. */
export function variantParams(routeId: 'R02' | 'R03' | 'R05', raw: string | undefined): ListParams {
  if (raw === undefined) return {}
  const list = parseVariantKey(routeId, decodeURIComponent(raw))
  if (!list) notFound()
  return list
}

/**
 * Kategorie der Seite R03: unbekannter Slug → 404; Slug der anderen Sprache → 308 auf den Slug der Seitensprache
 * (KONZEPT §2.4), Listen-Parameter bleiben erhalten.
 */
export async function resolveCategory(
  locale: Locale,
  slug: string,
  list: ListParams,
): Promise<PublicCategory> {
  const hit = await getCategoryBySlug(locale, decodeURIComponent(slug))
  if (!hit) notFound()
  if (hit.redirect)
    permanentRedirect(
      `${localizedPath('R03', locale, { slug: hit.canonicalSlug })}${listSearch(list)}`,
    )
  return hit.category
}

/** CMS-Texte der Seite (`pages.seo`, KONZEPT §3.0.5); leer → Vorlage je Seitentyp. */
async function pageSeo(key: 'shop' | 'archive', locale: Locale) {
  const seo = (await getPublicPage(key, locale))?.seo
  const text = (v: string | null | undefined) => (v && v.trim() ? v.trim() : undefined)
  return { title: text(seo?.metaTitle), description: text(seo?.metaDescription) }
}

export async function shopMetadata(locale: Locale, list: ListParams): Promise<Metadata> {
  const [t, seo] = await Promise.all([
    getTranslations({ locale, namespace: 'seo.descriptions' }),
    pageSeo('shop', locale),
  ])
  return buildListMetadata(
    'R02',
    locale,
    {},
    {
      page: list.page,
      title: seo.title,
      description: seo.description ?? t('shop'),
    },
  )
}

export async function categoryMetadata(
  locale: Locale,
  slug: string,
  list: ListParams,
): Promise<Metadata> {
  const hit = await getCategoryBySlug(locale, decodeURIComponent(slug))
  // Unbekannter Slug: 404-Metadaten aus `not-found.tsx` (noindex, ohne hreflang).
  if (!hit) notFound()
  const category = hit.category
  const alternateParams: Partial<Record<Locale, { slug: string }>> = {}
  for (const other of LOCALES) {
    if (other === locale) continue
    const alt = await getCategoryBySlug(other, category.slug)
    alternateParams[other] = { slug: alt?.canonicalSlug ?? category.slug }
  }
  const t = await getTranslations({ locale, namespace: 'seo.descriptions' })
  return buildListMetadata(
    'R03',
    locale,
    { slug: hit.canonicalSlug },
    {
      page: list.page,
      title: category.seo.metaTitle ?? `${category.name} · Shop`,
      description: category.seo.metaDescription ?? t('category'),
      alternateParams,
    },
  )
}

export async function archiveMetadata(locale: Locale, list: ListParams): Promise<Metadata> {
  const [t, seo] = await Promise.all([
    getTranslations({ locale, namespace: 'seo.descriptions' }),
    pageSeo('archive', locale),
  ])
  return buildListMetadata(
    'R05',
    locale,
    {},
    {
      page: list.page,
      title: seo.title,
      description: seo.description ?? t('archive'),
    },
  )
}

// --- beim Build vorgerenderte Varianten (ARCHITEKTUR §9.1) ----------------------------------------------------------

const pageKeys = (totalPages: number, base: ListParams = {}) =>
  Array.from({ length: Math.max(0, totalPages - 1) }, (_, i) =>
    variantKey({ ...base, page: i + 2 }),
  )

/** R02: „nur verfügbare“ und alle Folgeseiten nach aktuellem Bestand. */
export async function shopVariantKeys(locale: Locale): Promise<string[]> {
  const keys = [variantKey({ available: true })]
  try {
    const [all, available] = await Promise.all([
      loadShopProducts({ locale, page: 1 }),
      loadShopProducts({ locale, availableOnly: true, page: 1 }),
    ])
    keys.push(...pageKeys(all.totalPages), ...pageKeys(available.totalPages, { available: true }))
  } catch (err) {
    log.warn('shop.static_params_skipped', { reason: (err as Error).message })
  }
  return keys
}

/** R03: alle Kategorien mit ihrem Slug der Sprache. */
export async function categorySlugs(locale: Locale): Promise<string[]> {
  try {
    return (await loadAllCategories(locale)).map((c) => c.slug)
  } catch (err) {
    log.warn('category.static_params_skipped', { reason: (err as Error).message })
    return []
  }
}

/** R03-Varianten: „nur verfügbare“ und Folgeseiten der Kategorie. */
export async function categoryVariantKeys(locale: Locale, slug: string): Promise<string[]> {
  const keys = [variantKey({ available: true })]
  try {
    const hit = await getCategoryBySlug(locale, slug)
    if (hit && !hit.redirect) {
      const res = await loadShopProducts({ locale, categoryKeys: [hit.category.key], page: 1 })
      keys.push(...pageKeys(res.totalPages))
    }
  } catch (err) {
    log.warn('category.static_params_skipped', { reason: (err as Error).message })
  }
  return keys
}

/** R05: Kategorien mit Archiv-Stücken und Folgeseiten. */
export async function archiveVariantKeys(locale: Locale): Promise<string[]> {
  const keys: string[] = []
  try {
    const [all, archiveKeys, res] = await Promise.all([
      loadAllCategories(locale),
      loadArchiveCategoryKeys(),
      loadArchiveProducts({ locale, page: 1 }),
    ])
    keys.push(
      ...all
        .filter((c) => archiveKeys.includes(c.key))
        .map((c) => variantKey({ category: c.slug })),
      ...pageKeys(res.totalPages),
    )
  } catch (err) {
    log.warn('archive.static_params_skipped', { reason: (err as Error).message })
  }
  return keys
}
