import React from 'react'

import type { Locale } from '@/lib/enums'
import { formatMoney } from '@/lib/money'
import { formatItemNumber } from '@/lib/products/itemNumber'
import {
  EYELET_Y,
  TAG_HEIGHT,
  estimateTagWidth,
  tagAngle,
  tagOutlinePath,
  threadLength,
  type PriceTagVariant,
} from '@/lib/shop/priceTag'

import styles from './PriceTag.module.css'
import { SoldStamp } from './SoldStamp'

export type { PriceTagVariant }

// Preisschild (DESIGN KO-05, E-77): Flohmarkt-Anhänger, handgeschrieben, an der Schnur. Faden (Länge aus der Nummer) →
// Öse (Drehpunkt) → Schild-Körper „Kofferanhänger“ (SVG-Kontur mit Wackel, `--paper-2`, Schraffur-Schatten) → Preis in
// Mansalva mit `*` (Auflösung: `PriceFootnote` auf derselben Seite, R-030) und darunter `Nr. 017` in Plex Mono.
// Drehung und Fadenlänge sind deterministisch (SSR = Browser). Varianten: `hanging` (Shop, Faden-Anker für die Schnur
// `shopString`), `pinned` (Produktseite/Startseite, ohne Schnur), `mini` (Danke-Seite, 64 px, ohne Nummer).
// `sold` → Stempel KO-06 über der Preiszeile, der Preis bleibt lesbar. Das Schild ist nie selbst fokussierbar; in der
// Karte gehört es zum Karten-Link (KO-07). Schwingen (MI-02) steuert `price-tag-swing` über `data-price-tag-swing`.
export interface PriceTagProps {
  itemNumber: number
  priceCents: number
  locale: Locale
  variant?: PriceTagVariant
  /** Verkauft: Stempel sichtbar. */
  sold?: boolean
  /** Stempel auch bei nicht verkauften Stücken (verborgen) ins Markup legen – für den Live-Wechsel (MI-03). */
  stampSlot?: boolean
  className?: string
}

export function PriceTag({
  itemNumber,
  priceCents,
  locale,
  variant = 'hanging',
  sold = false,
  stampSlot = false,
  className,
}: PriceTagProps) {
  const price = formatMoney(priceCents, locale, { style: 'tag' })
  const angle = tagAngle(itemNumber)
  const thread = threadLength(itemNumber)
  const width = estimateTagWidth(price, variant)
  const height = TAG_HEIGHT[variant]
  const style = {
    '--tag-angle': `${angle}deg`,
    '--tag-thread': `${thread}px`,
    '--tag-eyelet-y': `${EYELET_Y}px`,
    '--tag-min-w': `${width}px`,
    '--tag-h': `${height}px`,
  } as React.CSSProperties
  return (
    <span
      className={[styles.tag, styles[variant], className].filter(Boolean).join(' ')}
      style={style}
      data-price-tag={variant}
      data-item-number={itemNumber}
      data-sold={sold ? '' : undefined}
    >
      <span
        className={styles.thread}
        aria-hidden="true"
        {...(variant === 'hanging' ? { 'data-leash-anchor': 'tag' } : {})}
      />
      <span className={`${styles.body} u-hatch-shadow`} data-price-tag-swing="" data-angle={angle}>
        <svg
          className={styles.outline}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <path d={tagOutlinePath(width, height, itemNumber)} />
        </svg>
        <span className={styles.eyelet} aria-hidden="true" />
        <span className={styles.price} data-money="">
          {price}
          <span aria-hidden="true">*</span>
        </span>
        {variant !== 'mini' ? (
          <span className={styles.nr}>{formatItemNumber(itemNumber, locale)}</span>
        ) : null}
        {sold || stampSlot ? (
          <span className={styles.stampLine}>
            <SoldStamp itemNumber={itemNumber} hidden={!sold} />
          </span>
        ) : null}
      </span>
    </span>
  )
}
