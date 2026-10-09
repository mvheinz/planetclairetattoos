import 'server-only'

import { unstable_cache } from 'next/cache'

import { TAGS } from '@/lib/cache/tags'
import { createLogger } from '@/lib/monitoring/logger'
import { getPublicPayload, getPublicSettings } from '@/lib/payload/public'
import type { Locale } from '@/lib/routes/registry'
import { pickShopDisplaySettings } from '@/lib/shop/displaySettings'

// Daten für Kopf, Menü und Fuß (KONZEPT §3.0.2/§3.0.3): Kategorien mit `showInNavigation`, ob eine aktive
// Konformitätserklärung existiert (Fußlink R27) und der Instagram-Name. Öffentlich gelesen (`getPublicPayload`,
// Seed-Filter greift), zwischengespeichert (Tags `categories`/`settings`, spätestens nach 60 s neu). Ist die Datenbank
// nicht erreichbar, bleibt der Rahmen vollständig: ohne Kategorien und ohne Konformitätslink, Instagram-Standard.

const log = createLogger()

export const DEFAULT_INSTAGRAM_HANDLE = 'planet.claire.tattoos'

export interface NavCategory {
  key: string
  name: string
  slug: string
}

export interface SiteNavigation {
  categories: NavCategory[]
  hasActiveConformity: boolean
  instagramHandle: string
  /** Zeile „Zahlung · Versand · Abholung“ im Seitenfuß (U-58 c); fehlt sie, gelten die Standardwerte. */
  shopFacts?: { prepaymentEnabled: boolean; pickupEnabled: boolean; pickupCity: string | null }
}

export const instagramUrl = (handle: string) => `https://www.instagram.com/${handle}/`

/** Lädt die Navigationsdaten (ungecacht; Grundlage für `getSiteNavigation` und die Startseite). */
export async function loadNavigation(locale: Locale): Promise<SiteNavigation> {
  const result: SiteNavigation = {
    categories: [],
    hasActiveConformity: false,
    instagramHandle: DEFAULT_INSTAGRAM_HANDLE,
  }
  try {
    const payload = await getPublicPayload()
    const [categories, conformity, settings] = await Promise.all([
      payload.find({
        collection: 'categories',
        where: { showInNavigation: { equals: true } },
        sort: 'sortOrder',
        locale,
        fallbackLocale: 'de',
        depth: 0,
        limit: 20,
        pagination: false,
      }),
      payload.count({
        collection: 'conformity-declarations',
        where: { status: { equals: 'active' } },
      }),
      getPublicSettings(),
    ])
    result.categories = categories.docs
      .filter((c) => c.slug && c.name)
      .map((c) => ({ key: String(c.key), name: String(c.name), slug: String(c.slug) }))
    result.hasActiveConformity = conformity.totalDocs > 0
    const handle = (settings.social as { instagramHandle?: unknown } | undefined)?.instagramHandle
    if (typeof handle === 'string' && /^[a-z0-9._]{1,30}$/.test(handle)) {
      result.instagramHandle = handle
    }
    const display = pickShopDisplaySettings(settings)
    result.shopFacts = {
      prepaymentEnabled:
        (settings.payment as { prepaymentEnabled?: unknown } | undefined)?.prepaymentEnabled !==
        false,
      pickupEnabled: display.pickupEnabled,
      pickupCity: display.pickupCity,
    }
  } catch (err) {
    log.warn('navigation.load_failed', { reason: (err as Error).message })
  }
  return result
}

/** Navigationsdaten je Sprache (gecacht). */
export const getSiteNavigation = (locale: Locale): Promise<SiteNavigation> =>
  unstable_cache(() => loadNavigation(locale), ['site-navigation', locale], {
    tags: [TAGS.categories, TAGS.settings, TAGS.page('conformity')],
    revalidate: 60,
  })()
