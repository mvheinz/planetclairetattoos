import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'

import { loadShopProducts, listShopProducts } from '@/lib/data/products'
import { isLocale, localizedPath } from '@/lib/routes/paths'
import { DEFAULT_LOCALE, type Locale } from '@/lib/routes/registry'
import { absoluteUrl, buildMetadata } from '@/lib/seo/metadata'
import { formatItemNumber, productPath } from '@/lib/shop/format'
import { canonicalListUrl, parseVariantKey, variantKey } from '@/lib/shop/listParams'

// R02 Shop – statische Listen-Variante (ARCHITEKTUR §9.1, Spike B-05). Der Proxy schreibt `/de/shop?available=1&page=2`
// intern auf `/de/shop/variant/available-1.page-2` um; die sichtbare und kanonische URL bleibt die Query-Form.
// Bekannte Kombinationen werden beim Build vorgerendert, weitere beim ersten Aufruf (ISR, `dynamicParams`).
// Prototyp aus P3.2: Die Darstellung (Filter-Chips, Karten, Preise mit Hinweis) liefert P3.5 – hier bewusst ohne
// Preise, damit keine Preisangabe ohne `PriceNote` erscheint (R-030).

export const revalidate = 3600
export const dynamicParams = true

type Params = { locale: string; variant: string }

/** Vorgerendert: „nur verfügbare“ und alle Folgeseiten nach aktuellem Bestand (ohne DB beim Build: nur Filter). */
export async function generateStaticParams({
  params,
}: {
  params: { locale: string }
}): Promise<{ variant: string }[]> {
  const locale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE
  const keys = [variantKey({ available: true })]
  try {
    const [all, available] = await Promise.all([
      loadShopProducts({ locale, page: 1 }),
      loadShopProducts({ locale, availableOnly: true, page: 1 }),
    ])
    for (let page = 2; page <= all.totalPages; page++) keys.push(variantKey({ page }))
    for (let page = 2; page <= available.totalPages; page++)
      keys.push(variantKey({ available: true, page }))
  } catch {
    // Datenbank beim Build nicht erreichbar: übrige Varianten entstehen beim ersten Aufruf.
  }
  return keys.map((variant) => ({ variant }))
}

function resolve(params: Params) {
  const locale: Locale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE
  const list = parseVariantKey('R02', decodeURIComponent(params.variant))
  return { locale, list }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale, list } = resolve(await params)
  const metadata = buildMetadata('R02', locale)
  if (list && metadata.alternates) {
    const url = (l: Locale) => absoluteUrl(canonicalListUrl(localizedPath('R02', l), list))
    metadata.alternates = {
      canonical: url(locale),
      languages: { de: url('de'), en: url('en'), 'x-default': url(DEFAULT_LOCALE) },
    }
  }
  return metadata
}

export default async function ShopVariantPage({ params }: { params: Promise<Params> }) {
  const { locale, list } = resolve(await params)
  if (!list) notFound()
  setRequestLocale(locale)
  const [t, result] = await Promise.all([
    getTranslations({ locale }),
    listShopProducts({ locale, availableOnly: list.available === true, page: list.page ?? 1 }),
  ])
  if ((list.page ?? 1) > result.totalPages) notFound()
  return (
    <div className="u-container" data-list-variant={variantKey(list)}>
      <h1>{t('common.routes.R02')}</h1>
      {result.docs.length === 0 ? (
        <p>{t('shop.list.empty')}</p>
      ) : (
        <ul>
          {result.docs.map((p) => (
            <li key={p.id} data-item-number={p.itemNumber}>
              <a href={productPath(p, locale)}>
                {p.title} · {formatItemNumber(p.itemNumber, locale)}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
