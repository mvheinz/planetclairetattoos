import 'server-only'

import { ImageResponse } from 'next/og'
import React from 'react'

import de from '@/i18n/messages/de.json'
import en from '@/i18n/messages/en.json'
import type { PublicProduct } from '@/lib/data/products'
import type { PublicFlash, PublicGalleryEntry } from '@/lib/data/tattoo'
import type { Locale } from '@/lib/enums'
import { createLogger } from '@/lib/monitoring/logger'
import { formatItemNumber } from '@/lib/products/itemNumber'
import { formatTagPrice } from '@/lib/shop/priceTag'

import { loadOgArt, loadOgFonts, readFallbackPng } from './assets'
import { productPhotoDataUrl, type OgMediaInput } from './photo'
import { DefaultOgImage, OG_SIZE, ProductOgImage, TattooOgImage } from './templates'

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

// --- Tattoo: Flash und Galerie (U-61, P14.12) ---------------------------------------------------------------------

/** Alt-Text des Flash-Bilds. */
export function flashOgAlt(flash: Pick<PublicFlash, 'display' | 'title'> | null, locale: Locale) {
  const m = og(locale)
  return flash
    ? m.flashAlt.replace('{number}', flash.display).replace('{title}', flash.title)
    : m.flashAltEmpty
}

/** Alt-Text des Galerie-Bilds (ohne passendes Foto: Standardbild). */
export const galleryOgAlt = (entry: PublicGalleryEntry | null, locale: Locale) =>
  entry ? og(locale).galleryAlt : og(locale).defaultAlt

/** Flash (R12): Zeichnung des ersten verfügbaren Motivs links, „Flash-Motive“ und „F-012 – Titel“ rechts. */
export async function renderFlashOg(flash: PublicFlash | null, locale: Locale): Promise<Response> {
  const m = og(locale)
  const [art, photo] = await Promise.all([
    loadOgArt(),
    productPhotoDataUrl((flash?.image ?? null) as OgMediaInput | null),
  ])
  return png(
    <TattooOgImage
      kicker={m.flashKicker}
      title={m.flashTitle}
      subtitle={flash ? `${flash.display} – ${flash.title}` : m.flashSubEmpty}
      photo={photo}
      seed={flash?.number ?? 12}
      art={art}
    />,
  )
}

/** Galerie (R15): ein Foto mit Einwilligung (nie Seed-Ausnahme); ohne solches Foto das Standardbild. */
export async function renderGalleryOg(
  entry: PublicGalleryEntry | null,
  locale: Locale,
): Promise<Response> {
  if (!entry) return renderDefaultOg(locale)
  const m = og(locale)
  const [art, photo] = await Promise.all([
    loadOgArt(),
    productPhotoDataUrl(entry.image as OgMediaInput),
  ])
  if (!photo) return renderDefaultOg(locale)
  return png(
    <TattooOgImage
      kicker={m.galleryKicker}
      title={m.galleryTitle}
      subtitle={m.gallerySub}
      photo={photo}
      seed={entry.id}
      art={art}
    />,
  )
}
