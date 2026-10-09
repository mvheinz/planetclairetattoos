import 'server-only'

import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import type { ReactElement } from 'react'

import type { Locale } from '@/lib/routes/registry'
import type { ListParams } from '@/lib/shop/listParams'

// Gemeinsame Hülle der statischen Listen-Varianten (P14.13, U-62; ARCHITEKTUR §9.1, Spike B-05): R02 Shop, R03 Kategorie,
// R05 Archiv, R12 Flash und R15 Galerie schreiben Filter-Parameter per Proxy auf `…/variant/[variant]` um. Jede Seite
// liefert nur, was sie unterscheidet (Sprache, Varianten-Parser, vorgerenderte Schlüssel, Metadaten, Inhalt); die Hülle
// verbindet das zu `generateStaticParams`, `generateMetadata` und der Seite. `revalidate` und `dynamicParams` bleiben als
// Literale in jeder `page.tsx` (Next liest Segment-Optionen statisch).

export type VariantRouteParams = { locale: string; variant: string }

export interface ListVariantSpec<P extends VariantRouteParams> {
  /** Sprache aus dem Segment (Shop: Rückfall auf Deutsch, Tattoo: unbekannt → 404). */
  locale: (raw: string) => Locale
  /** Filter-Parameter aus dem Varianten-Schlüssel; nicht kanonisch → 404 (`notFound()` im Parser). */
  list: (variant: string) => ListParams
  /** Beim Build vorgerenderte Segmente ohne Sprache (die kommt aus dem Layout); weitere per ISR. */
  staticParams: (locale: Locale) => Promise<Omit<P, 'locale'>[]> | Omit<P, 'locale'>[]
  /** Metadaten, wie die Seite sie bisher selbst erzeugt hat. */
  metadata: (params: P) => Promise<Metadata>
  /** Inhalt der Seite; `setRequestLocale` hat die Hülle schon gesetzt. */
  render: (locale: Locale, list: ListParams, params: P) => Promise<ReactElement> | ReactElement
}

export function listVariantPage<P extends VariantRouteParams>(spec: ListVariantSpec<P>) {
  async function generateStaticParams({
    params,
  }: {
    params: { locale: string }
  }): Promise<Omit<P, 'locale'>[]> {
    return spec.staticParams(spec.locale(params.locale))
  }

  async function generateMetadata({ params }: { params: Promise<P> }): Promise<Metadata> {
    return spec.metadata(await params)
  }

  async function ListVariantPage({ params }: { params: Promise<P> }): Promise<ReactElement> {
    const p = await params
    const locale = spec.locale(p.locale)
    const list = spec.list(p.variant)
    setRequestLocale(locale)
    return spec.render(locale, list, p)
  }

  return { generateStaticParams, generateMetadata, Page: ListVariantPage }
}
