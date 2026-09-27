import { revalidatePath, revalidateTag, updateTag } from 'next/cache'

import { createLogger } from '@/lib/monitoring/logger'
import type { AppContext } from '@/lib/payload/context'

import { productTags } from './tags'

// Einziger Weg zur Cache-Erneuerung (ARCHITEKTUR §9.3). Bei `context.seed` wird nichts ausgelöst.
const log = createLogger()

export interface RevalidateOptions {
  /** Kontext des auslösenden Requests (`seed` → nichts tun). */
  context?: AppContext
  /** Sofort sichtbar (`{ expire: 0 }`), z. B. Verkauf/Reservierung; sonst `'max'` (≤ 60 s). */
  immediate?: boolean
  /** Aufruf aus einer Server-Action: `updateTag` (read-your-own-writes). */
  inServerAction?: boolean
}

/** Tags erneuern; außerhalb eines Next-Requests (Skripte, Tests) nur Warnung, kein Abbruch. */
function expireTags(tags: string[], opts: RevalidateOptions): string[] {
  if (opts.context?.seed) return []
  for (const tag of tags) {
    try {
      if (opts.inServerAction) updateTag(tag)
      else revalidateTag(tag, opts.immediate ? { expire: 0 } : 'max')
    } catch (err) {
      log.warn('cache.revalidate_skipped', { tag, reason: (err as Error).message })
    }
  }
  return tags
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

/** Alles erneuern (z. B. nach „Beispieldaten entfernen“). */
export function revalidateAll(opts: Pick<RevalidateOptions, 'context'> = {}): boolean {
  if (opts.context?.seed) return false
  try {
    revalidatePath('/', 'layout')
  } catch (err) {
    log.warn('cache.revalidate_skipped', { tag: '*', reason: (err as Error).message })
  }
  return true
}
