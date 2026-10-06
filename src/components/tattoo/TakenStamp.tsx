import React from 'react'

import stampStyles from '@/components/shop/SoldStamp.module.css'
import { STAMP_VIEWBOX, stampAngle, stampFramePaths } from '@/lib/shop/priceTag'

import styles from './Tattoo.module.css'

// Stempel „vergeben“/„taken“ an vergebenen Flash-Motiven (DESIGN KO-20): Stempeloptik wie KO-06, aber in `--stencil`.
// Rein dekorativ (`aria-hidden`) – der Zustand steht als Text auf der Karte. Statisch (ruhiger Tattoo-Bereich).
export function TakenStamp({ number, label }: { number: number; label: string }) {
  const angle = stampAngle(number)
  return (
    <span
      className={`${stampStyles.stamp} ${styles.takenStamp}`}
      style={{ '--stamp-angle': `${angle}deg` } as React.CSSProperties}
      data-taken-stamp=""
      data-stamp=""
      aria-hidden="true"
    >
      <svg
        className={stampStyles.frame}
        viewBox={`0 0 ${STAMP_VIEWBOX.w} ${STAMP_VIEWBOX.h}`}
        preserveAspectRatio="none"
        focusable="false"
      >
        {stampFramePaths(number).map((d, i) => (
          <path key={i} d={d} />
        ))}
      </svg>
      <span className={stampStyles.word}>{label}</span>
    </span>
  )
}
