import 'server-only'

import { unstable_cache } from 'next/cache'

import { createLogger } from '@/lib/monitoring/logger'

// Daten-Cache der öffentlichen Lesefunktionen (ARCHITEKTUR §9.2): einzige Stelle, die `unstable_cache` benutzt. Ein
// späterer Wechsel auf Cache Components (Spike B-04) betrifft nur diese Datei. Die Argumente der Funktion gehören zum
// Cache-Schlüssel (JSON), die Tags stammen aus `src/lib/cache/tags.ts` (§9.3). Ergebnisse müssen JSON-fähig sein.

const log = createLogger()

/** Rückfall-Erneuerung in Sekunden (§9.1: `revalidate = 3600`); gezielt erneuern die Tags. */
export const DEFAULT_REVALIDATE_SECONDS = 3600

export interface CachedOptions<A extends unknown[]> {
  /** Eindeutiger Schlüssel-Präfix der Funktion, z. B. `shop-products`. */
  key: string
  /** Tags fest oder je Aufruf (aus dem Argument-Tupel). */
  tags: readonly string[] | ((args: NoInfer<A>) => readonly string[])
  /** Sekunden bis zur Rückfall-Erneuerung; `false` = nur über Tags. */
  revalidate?: number | false
}

/** Außerhalb eines Next-Requests (Skripte, Vitest) fehlt der Inkrement-Cache – dann ungecacht ausführen. */
const isMissingCache = (err: unknown) =>
  err instanceof Error && /incrementalCache missing/i.test(err.message)

/** Umhüllt `fn` mit dem Daten-Cache (`unstable_cache`) und gibt eine Funktion mit derselben Signatur zurück. */
export function cached<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  options: CachedOptions<A>,
): (...args: A) => Promise<R> {
  const revalidate = options.revalidate ?? DEFAULT_REVALIDATE_SECONDS
  return async (...args: A): Promise<R> => {
    const tags = typeof options.tags === 'function' ? options.tags(args) : options.tags
    try {
      return await unstable_cache(fn, [options.key], { tags: [...tags], revalidate })(...args)
    } catch (err) {
      if (!isMissingCache(err)) throw err
      log.debug('cache.bypassed', { key: options.key })
      return fn(...args)
    }
  }
}
