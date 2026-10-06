import React from 'react'

import { STAMP_VIEWBOX, stampAngle, stampFramePaths } from '@/lib/shop/priceTag'

import styles from './SoldStamp.module.css'

// „sold“-Stempel (DESIGN KO-06): Wort `sold` (Spectral Italic, `--petrol`, `lang="en"`) in einem rauen Rahmen mit Lücken,
// Fehlstellen im Wort über eine statische Maske (Druckbild), `mix-blend-mode: multiply`, Deckkraft 0.92, Drehung
// −14° ± 2° nach Objektnummer. Rein dekorativ (`aria-hidden`): der Zustand „verkauft“ steht als Text im zugänglichen
// Namen der Karte bzw. auf der Produktseite. Statisch; den „Knall“ (MI-03) spielt nur `sold-stamp` beim Live-Wechsel.
// `hidden`: im Markup vorhanden, aber unsichtbar (Karte noch verfügbar – `sold-stamp` blendet ihn beim Verkauf ein).
export function SoldStamp({
  itemNumber,
  hidden = false,
  className,
}: {
  itemNumber: number
  hidden?: boolean
  className?: string
}) {
  const angle = stampAngle(itemNumber)
  return (
    <span
      className={className ? `${styles.stamp} ${className}` : styles.stamp}
      style={{ '--stamp-angle': `${angle}deg` } as React.CSSProperties}
      data-sold-stamp=""
      data-angle={angle}
      aria-hidden="true"
      hidden={hidden}
    >
      <svg
        className={styles.frame}
        viewBox={`0 0 ${STAMP_VIEWBOX.w} ${STAMP_VIEWBOX.h}`}
        preserveAspectRatio="none"
        focusable="false"
      >
        {stampFramePaths(itemNumber).map((d, i) => (
          <path key={i} d={d} />
        ))}
      </svg>
      <span className={styles.word} lang="en">
        sold
      </span>
    </span>
  )
}
