import React from 'react'

import { ResponsiveImage } from '@/components/media/ResponsiveImage'
import { translatorFor } from '@/i18n/translator'
import { ENUM_LABELS } from '@/lib/enumLabels'
import type { Locale, ProductCategory } from '@/lib/enums'
import { formatTagPrice } from '@/lib/shop/priceTag'
import { formatDimensions, productPath, type DimensionsInput } from '@/lib/shop/format'
import type { Media } from '@/payload-types'

import { Badge } from './Badge'
import styles from './ProductCard.module.css'
import { PriceTag } from './PriceTag'

// Produktkarte (DESIGN KO-07): die ganze Karte ist genau ein `<a>` (keine verschachtelten Bedienelemente), zugänglicher
// Name „{Titel}, {Preis}{, gerade reserviert | , verkauft}“ (AK-DS-10). Aufbau: Foto 4:5 (Fokuspunkt, Dominanzfarbe als
// Lade-Hintergrund, `srcset` aus `thumb`/`card`) → Faden-Anker der Schnur → Preisschild `hanging` (8 px Einzug) → Titel
// (max. 2 Zeilen) → Meta „Keramik · Ø 14 cm“. `reserved`: Badge oben links auf dem Foto; `sold`: Foto gedämpft (0.82),
// Stempel auf dem Schild, Text ungedämpft. Keine Info nur bei Hover (Hover löst nur MI-02 aus). Für den Live-Zustand
// (`product-status`, P3.11) liegen Badge und Stempel verborgen im Markup; `gone` dämpft wie `sold`. Auf der Startseite
// (KO-21, P3.12) ohne Schnur: Schild `pinned` am Kartenfuß (`tag="pinned"`).

export const CARD_IMAGE_SIZES = '(min-width: 1200px) 25vw, (min-width: 768px) 33vw, 50vw'
/** Die ersten Karten einer Liste laden ohne `loading="lazy"` (KO-07). */
export const EAGER_CARDS = 2

export interface ProductCardData {
  id: number
  itemNumber: number
  title?: string | null
  slug?: string | null
  priceCents: number
  status: string
  category: ProductCategory
  dimensions?: DimensionsInput | null
  images?: (number | Media)[] | null
}

export type CardState = 'available' | 'reserved' | 'sold'

export function cardState(status: string): CardState {
  return status === 'reserved' || status === 'sold' ? status : 'available'
}

export function ProductCard({
  product,
  locale,
  index = 0,
  tag = 'hanging',
  lazy = false,
  stampSlot = true,
}: {
  product: ProductCardData
  locale: Locale
  /** Position in der Liste (0-basiert): die ersten zwei laden sofort. */
  index?: number
  /**
   * `hanging`: Shop – Schild unter dem Foto am Faden der Schnur. `pinned`: Startseite (KO-21) – ohne Schnur, Schild am
   * Kartenfuß.
   */
  tag?: 'hanging' | 'pinned'
  /** Alle Fotos `loading="lazy"` (Karten weit unter dem ersten Bildschirm, z. B. Startseite). */
  lazy?: boolean
  /** Verborgener Stempel für den Live-Wechsel auf `sold` (MI-03); ohne ihn dämpft `product-status` nur. */
  stampSlot?: boolean
}) {
  const t = translatorFor(locale, 'shop.card')
  const state = cardState(product.status)
  const title = product.title?.trim() || ENUM_LABELS.PRODUCT_CATEGORIES[product.category].de
  const price = formatTagPrice(product.priceCents, locale)
  const stateText =
    state === 'reserved' ? `, ${t('stateReserved')}` : state === 'sold' ? `, ${t('stateSold')}` : ''
  const label = ENUM_LABELS.PRODUCT_CATEGORIES[product.category]
  const categoryName = (locale === 'en' ? label.en : undefined) ?? label.de
  const dims = formatDimensions(product.dimensions, locale)
  const photo = product.images?.find((m): m is Media => typeof m === 'object' && m !== null)
  const priceTag = (
    <PriceTag
      itemNumber={product.itemNumber}
      priceCents={product.priceCents}
      locale={locale}
      variant={tag}
      sold={state === 'sold'}
      stampSlot={stampSlot}
      className={tag === 'pinned' ? styles.tagFoot : styles.tag}
    />
  )
  return (
    <a
      className={styles.card}
      href={productPath(product, locale)}
      aria-label={`${title}, ${price}${stateText}`}
      data-product-card=""
      data-product-id={product.id}
      data-item-number={product.itemNumber}
      data-status={state}
    >
      <span className={styles.photo}>
        <ResponsiveImage
          media={photo}
          aspectRatio="4 / 5"
          sizes={CARD_IMAGE_SIZES}
          srcSizes={['thumb', 'card']}
          loading={!lazy && index < EAGER_CARDS ? 'eager' : 'lazy'}
          className={styles.image}
        />
        {state === 'sold' ? null : (
          // Bei `available` verborgen im Markup – `product-status` blendet es beim Live-Wechsel ein (P3.11).
          <Badge
            kind="reserved"
            locale={locale}
            onPhoto
            hidden={state !== 'reserved'}
            className={styles.reserved}
          />
        )}
      </span>
      {tag === 'hanging' ? priceTag : null}
      <span className={styles.title}>{title}</span>
      <span className={styles.meta}>{dims ? `${categoryName} · ${dims}` : categoryName}</span>
      {tag === 'pinned' ? priceTag : null}
    </a>
  )
}
