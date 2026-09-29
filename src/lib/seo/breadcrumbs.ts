import de from '@/i18n/messages/de.json'
import en from '@/i18n/messages/en.json'
import type { Locale } from '@/lib/enums'
import { localizedPath } from '@/lib/routes/paths'

import type { BreadcrumbItem } from './jsonld'
import { absoluteUrl, SITE_NAME } from './metadata'

// Brotkrumen für `BreadcrumbList` (KONZEPT §3.0.5, P3.13) auf R02–R05 – ohne sichtbare Brotkrumen-Navigation, nur als
// JSON-LD: Start → Shop (→ Kategorie (→ Stück)) bzw. Start → Archiv. Absolute URLs mit Apex-Domain, Pfade der Seitensprache.

const ROUTE_NAMES = { de: de.common.routes, en: en.common.routes } as const

export interface CategoryCrumb {
  name: string
  /** Slug der Seitensprache. */
  slug: string
}

export type BreadcrumbTarget =
  | { routeId: 'R02' }
  | { routeId: 'R05' }
  | { routeId: 'R03'; category: CategoryCrumb }
  | {
      routeId: 'R04'
      category: CategoryCrumb | null
      title: string
      /** Pfad der Produktseite in der Seitensprache (`productPath`). */
      path: string
    }

export function breadcrumbItems(
  target: BreadcrumbTarget,
  locale: Locale,
  siteUrl?: string,
): BreadcrumbItem[] {
  const names = ROUTE_NAMES[locale]
  const url = (path: string) => absoluteUrl(path, siteUrl)
  const items: BreadcrumbItem[] = [{ name: SITE_NAME, url: url(localizedPath('R01', locale)) }]
  if (target.routeId === 'R05') {
    items.push({ name: names.R05, url: url(localizedPath('R05', locale)) })
    return items
  }
  items.push({ name: names.R02, url: url(localizedPath('R02', locale)) })
  if (target.routeId === 'R02') return items
  const { category } = target
  if (category) {
    items.push({
      name: category.name,
      url: url(localizedPath('R03', locale, { slug: category.slug })),
    })
  }
  if (target.routeId === 'R04') items.push({ name: target.title, url: url(target.path) })
  return items
}
