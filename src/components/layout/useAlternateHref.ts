'use client'

import { useSyncExternalStore } from 'react'

import { alternateForMatch } from '@/lib/routes/paths'
import { LOCALES, type Locale } from '@/lib/routes/registry'

import { useCurrentRoute } from './useCurrentRoute'

/**
 * Ziel des Sprachwechsels für die aktuelle Seite (KONZEPT §2.6, U-47): aus der Registry-Route (`alternateForMatch`,
 * auf Server und Client gleich). Routen mit sprachabhängigem `slug` (Kategorie, Stück) haben ohne Daten kein sicheres
 * Gegenstück – dort übernimmt der Haken nach dem Hydrieren das Ziel aus den hreflang-Alternativen im `<head>`
 * (`<link rel="alternate" hreflang>`, aus den Seiten-Metadaten); ohne JavaScript bleibt die Startseite der anderen
 * Sprache.
 */
export function useAlternateHref(): (l: Locale) => string {
  const match = useCurrentRoute()
  const slugRoute = !!match && 'slug' in match.params
  const head = useSyncExternalStore(subscribeHead, readHeadAlternates, () => '')
  const fromHead = slugRoute && head ? (JSON.parse(head) as Partial<Record<Locale, string>>) : null
  return (l) => fromHead?.[l] ?? alternateForMatch(match, l)
}

/** Änderungen im `<head>` (Metadaten nach einem Seitenwechsel ohne Neuladen) melden. */
function subscribeHead(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange)
  observer.observe(document.head, { childList: true, subtree: true, attributes: true })
  return () => observer.disconnect()
}

/** hreflang-Alternativen als Pfade (JSON-Text, damit der Schnappschuss stabil vergleichbar ist; leer = keine). */
function readHeadAlternates(): string {
  const hrefs: Partial<Record<Locale, string>> = {}
  for (const l of LOCALES) {
    const link = document.head.querySelector<HTMLLinkElement>(
      `link[rel="alternate"][hreflang="${l}"]`,
    )
    if (!link?.href) continue
    try {
      const url = new URL(link.href, window.location.href)
      hrefs[l] = `${url.pathname}${url.search}`
    } catch {
      // ungültige Adresse: Rückfall auf die Startseite
    }
  }
  return Object.keys(hrefs).length ? JSON.stringify(hrefs) : ''
}
