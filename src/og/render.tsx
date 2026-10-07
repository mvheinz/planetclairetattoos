import 'server-only'

import { ImageResponse } from 'next/og'
import React from 'react'

import de from '@/i18n/messages/de.json'
import en from '@/i18n/messages/en.json'
import type { PublicProduct } from '@/lib/data/products'
import type { Locale } from '@/lib/enums'
import { createLogger } from '@/lib/monitoring/logger'
import { formatItemNumber } from '@/lib/products/itemNumber'
import { formatTagPrice } from '@/lib/shop/priceTag'

import { loadOgArt, loadOgFonts, readFallbackPng } from './assets'
import { productPhotoDataUrl, type OgMediaInput } from './photo'
import { DefaultOgImage, OG_SIZE, ProductOgImage } from './templates'

// OG-Bilder erzeugen (P3.14, DESIGN §12.6, KONZEPT §3.0.5): PNG 1200 × 630 per `next/og` mit den TTF-Schriften aus
// `src/og/fonts/`. Scheitert das Erzeugen, liefert die Route das statische Standardbild `public/og/default.png`.

export const OG_CONTENT_TYPE = 'image/png'

const MESSAGES = { de, en } as const
const log = createLogger()

const og = (locale: Locale) => MESSAGES[locale].seo.og

/** Alt-Text des Produktbilds („{Titel} – Nr. 017: Foto und Preisschild“). */
export function productOgAlt(
  product: Pick<PublicProduct, 'title' | 'itemNumber'>,
  locale: Locale,
): string {
  return og(locale)
    .productAlt.replace('{title}', product.title ?? '')
    .replace('{number}', formatItemNumber(product.itemNumber, locale))
    .trim()
}

export const defaultOgAlt = (locale: Locale) => og(locale).defaultAlt

async function png(element: React.ReactElement): Promise<Response> {
  let body: ArrayBuffer
  try {
    const fonts = await loadOgFonts()
    body = await new ImageResponse(element, { ...OG_SIZE, fonts }).arrayBuffer()
  } catch (err) {
    log.warn('og.render_failed', { reason: (err as Error).message })
    const fallback = await readFallbackPng()
    body = fallback.buffer.slice(
      fallback.byteOffset,
      fallback.byteOffset + fallback.byteLength,
    ) as ArrayBuffer
  }
  return new Response(body, { headers: { 'content-type': OG_CONTENT_TYPE } })
}

/** Standardbild (Linienpapier, Planet-Marke, Wortmarke, Zeile „Tattoos & Unikate aus Berlin“, Coco). */
export async function renderDefaultOg(locale: Locale): Promise<Response> {
  const art = await loadOgArt()
  return png(<DefaultOgImage tagline={og(locale).tagline} art={art} />)
}

/** Produktbild: erstes Foto 504 × 630, Titel, Preisschild, `Nr. 017`, Wortmarke; verkauft mit Stempel „sold“. */
export async function renderProductOg(product: PublicProduct, locale: Locale): Promise<Response> {
  const [art, photo] = await Promise.all([
    loadOgArt(),
    productPhotoDataUrl((product.images?.[0] ?? null) as OgMediaInput | number | null),
  ])
  return png(
    <ProductOgImage
      title={product.title ?? ''}
      itemNumber={product.itemNumber}
      itemNumberText={formatItemNumber(product.itemNumber, locale)}
      priceText={formatTagPrice(product.priceCents, locale)}
      priceNote={og(locale).priceNote}
      sold={product.status === 'sold'}
      soldText={MESSAGES[locale].errors.soldStamp}
      photo={photo}
      art={art}
    />,
  )
}
