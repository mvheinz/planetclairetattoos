import { revalidatePath, revalidateTag, updateTag } from 'next/cache'

import { createLogger } from '@/lib/monitoring/logger'
import type { AppContext } from '@/lib/payload/context'
import { localizedPath } from '@/lib/routes/paths'
import { LOCALES } from '@/lib/routes/registry'

import { TAGS, productTags } from './tags'

// Einziger Weg zur Cache-Erneuerung (ARCHITEKTUR §9.3, PLAN P3.15). Bei `context.seed` wird nichts ausgelöst.
// - Statuswechsel (`immediate`): `revalidateTag(tag, { expire: 0 })` – die nächste Anfrage rendert blockierend neu
//   (Route-Handler, Payload-Endpunkte und -Hooks, Jobs); in Server-Actions `updateTag(tag)` (read-your-own-writes).
// - Bearbeitungen: `revalidateTag(tag, 'max')` – stale-while-revalidate, sichtbar ≤ 60 s.
// Next führt die Erneuerung erst am Ende des Requests aus, also nach dem Commit der Payload-Transaktion.
const log = createLogger()

export interface RevalidateOptions {
  /** Kontext des auslösenden Requests (`seed` → nichts tun). */
  context?: AppContext
  /** Sofort sichtbar (`{ expire: 0 }`), z. B. Verkauf/Reservierung; sonst `'max'` (≤ 60 s). */
  immediate?: boolean
  /** Aufruf aus einer Server-Action: `updateTag` (read-your-own-writes). */
  inServerAction?: boolean
}

const skipped = (tag: string, err: unknown) =>
  log.warn('cache.revalidate_skipped', { tag, reason: (err as Error)?.message })

/** `updateTag` gibt es nur in Server-Actions; anderswo (Route-Handler) greift `{ expire: 0 }` mit gleicher Wirkung. */
function expireNow(tag: string): void {
  try {
    updateTag(tag)
  } catch {
    revalidateTag(tag, { expire: 0 })
  }
}

/** Tags erneuern; außerhalb eines Next-Requests (Skripte, Tests) nur Warnung, kein Abbruch. */
function expireTags(tags: string[], opts: RevalidateOptions): string[] {
  if (opts.context?.seed) return []
  const unique = [...new Set(tags)]
  for (const tag of unique) {
    try {
      if (opts.inServerAction) expireNow(tag)
      else revalidateTag(tag, opts.immediate ? { expire: 0 } : 'max')
    } catch (err) {
      skipped(tag, err)
    }
  }
  return unique
}

/** Stück geändert: `product:<id>`, `products`, `home`, `sitemap` und ggf. `category:<key>`. */
export function revalidateProduct(
  id: number | string,
  opts: RevalidateOptions & { category?: string | null } = {},
): string[] {
  return expireTags(productTags(id, opts.category), opts)
}

/** Inhalt geändert: `key` ist ein Tag aus `TAGS` (z. B. `page:home`, `faqs`, `settings`, `legal:agb`). */
export function revalidateContent(key: string, opts: RevalidateOptions = {}): string[] {
  const immediate = opts.immediate ?? key.startsWith('legal:')
  return expireTags([key], { ...opts, immediate })
}

/** Routen mit Angeboten (R-171, KONZEPT §8.2): Startseite, Tattoo-Übersicht und Angebote. */
export const OFFER_ROUTE_IDS = ['R01', 'R11', 'R13'] as const

/**
 * Beginn oder Ende eines Angebots (Task `revalidateEndedOffers`, ARCHITEKTUR §9.3): `tattoo-offers` und `home` sofort
 * (`{ expire: 0 }`) und die Pfade von R01, R11, R13 in beiden Sprachen. Liefert die erneuerten Tags und Pfade.
 */
export function revalidateOfferPages(opts: Pick<RevalidateOptions, 'context'> = {}): string[] {
  const tags = expireTags([TAGS.tattooOffers, TAGS.home], { ...opts, immediate: true })
  if (opts.context?.seed) return tags
  const paths: string[] = []
  for (const id of OFFER_ROUTE_IDS) {
    for (const locale of LOCALES) {
      const path = localizedPath(id, locale)
      try {
        revalidatePath(path)
      } catch (err) {
        skipped(path, err)
      }
      paths.push(path)
    }
  }
  return [...tags, ...paths]
}

/** Alles erneuern (z. B. nach „Beispieldaten entfernen“). */
export function revalidateAll(opts: Pick<RevalidateOptions, 'context'> = {}): boolean {
  if (opts.context?.seed) return false
  try {
    revalidatePath('/', 'layout')
  } catch (err) {
    skipped('*', err)
  }
  return true
}
