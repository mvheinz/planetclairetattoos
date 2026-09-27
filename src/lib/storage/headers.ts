import 'server-only'

import type { CacheClass, UploadArea } from './types'

// Antwort-Header der Dateirouten (ARCHITEKTUR §3.3, DATENMODELL §6.2): uneingeschränkte Medien `immutable`,
// einwilligungsabhängige und Seed-Medien höchstens 5 Minuten (Widerruf wirkt schnell, R-172/L-20), private Dateien nie
// im Cache.

export const CACHE_HEADERS: Record<CacheClass, Readonly<Record<string, string>>> = {
  immutable: {
    'Cache-Control': 'public, max-age=31536000, immutable',
    'CDN-Cache-Control': 'public, max-age=31536000, immutable',
  },
  short: {
    'Cache-Control': 'public, max-age=300',
    'CDN-Cache-Control': 'max-age=300',
  },
  private: {
    'Cache-Control': 'private, no-store',
    'CDN-Cache-Control': 'no-store',
  },
}

type DocLike = Record<string, unknown> | null | undefined

/**
 * Cache-Klasse einer Datei. Unbekanntes wird konservativ behandelt (kurz statt `immutable`).
 * `documents` bleibt kurz gecacht, weil PDF-Dateinamen keinen Inhalts-Hash tragen (OFFENE-PUNKTE, P1.8).
 */
export function cacheClassFor(area: UploadArea, doc: DocLike): CacheClass {
  if (area === 'private') return 'private'
  if (!doc) return 'short'
  // Gesperrte Bilder sieht nur die Verwaltung – nie in einen geteilten Cache.
  if (doc.restricted === true) return 'private'
  if (doc.seed === true || doc.showsPerson === 'customer') return 'short'
  return area === 'media' ? 'immutable' : 'short'
}

export function applyCacheHeaders(headers: Headers, cls: CacheClass): Headers {
  for (const [k, v] of Object.entries(CACHE_HEADERS[cls])) headers.set(k, v)
  return headers
}

/**
 * `upload.modifyResponseHeaders`: private Dateien immer `private, no-store`; sonst bleibt ein vom Datei-Handler
 * gesetzter Wert, und ohne Wert gilt die kurze Klasse.
 */
export function modifyResponseHeadersFor(area: UploadArea) {
  return ({ headers }: { headers: Headers }): Headers => {
    if (area === 'private') return applyCacheHeaders(headers, 'private')
    if (!headers.has('Cache-Control')) return applyCacheHeaders(headers, 'short')
    return headers
  }
}
