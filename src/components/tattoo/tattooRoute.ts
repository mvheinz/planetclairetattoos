import 'server-only'

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { isLocale } from '@/lib/routes/paths'
import type { Locale } from '@/lib/routes/registry'
import { buildMetadata } from '@/lib/seo/metadata'
import { parseVariantKey, type ListParams } from '@/lib/shop/listParams'

import type { TattooRouteId } from './TattooSubNav'

// Gemeinsame Routen-Logik der Tattoo-Seiten R11–R18: Sprache prüfen, Varianten-Schlüssel der Filter (R12
// `?available=1`, R15 `?kind=` – statische Varianten wie im Shop, Spike B-05) und Metadaten (Titel
// „{Seitentitel} · Tattoo · Planet Claire“, canonical ohne Filter-Parameter).

/** Sprache aus den Routen-Parametern; unbekannt → 404. */
export function tattooLocale(raw: string): Locale {
  if (!isLocale(raw)) notFound()
  return raw
}

/** Parameter aus dem Varianten-Segment; nicht kanonischer Schlüssel → 404. */
export function tattooVariantParams(routeId: 'R12' | 'R15', raw: string | undefined): ListParams {
  if (raw === undefined) return {}
  const list = parseVariantKey(routeId, decodeURIComponent(raw))
  if (!list) notFound()
  return list
}

export function tattooMetadata(routeId: TattooRouteId) {
  return async ({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> => {
    const { locale } = await params
    return buildMetadata(routeId, isLocale(locale) ? locale : 'de')
  }
}
