import React from 'react'

import { PriceNote, type PriceNoteInput } from './PriceNote'
import { ShippingNoteLink } from './ShippingNoteLink'
import styles from './PriceFootnote.module.css'

// Auflösung des Sternchens an Preisschildern (R-030): „* Endpreis · gemäß § 19 UStG … · zzgl. Versandkosten“ gut
// sichtbar auf derselben Seite (unter dem Raster). Genau einmal je Seite – die feste `id` macht eine Doppelung für die
// a11y-Prüfung sichtbar (doppelte IDs); Preisschilder verweisen per `aria-describedby` darauf.
export const PRICE_FOOTNOTE_ID = 'price-footnote'

export function PriceFootnote(props: PriceNoteInput & { className?: string }) {
  const { className, ...input } = props
  return (
    <p
      id={PRICE_FOOTNOTE_ID}
      className={className ? `${styles.footnote} ${className}` : styles.footnote}
      data-price-footnote=""
    >
      <span aria-hidden="true">* </span>
      <PriceNote {...input} className={styles.note} /> · <ShippingNoteLink locale={input.locale} />
    </p>
  )
}
