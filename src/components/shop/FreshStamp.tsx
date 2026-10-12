import React from 'react'

import { translatorFor } from '@/i18n/translator'
import type { Locale } from '@/lib/enums'
import { freshStampAngle, stampFramePaths, STAMP_VIEWBOX } from '@/lib/shop/priceTag'

import styles from './FreshStamp.module.css'

// Stempel „frisch im Shop“ (V-60, U-93, P20.3; DESIGN KO-06a): Geschwister des „sold“-Stempels KO-06 – derselbe raue
// Rahmen mit Lücken (`stampFramePaths`, anderer Startwert), Wort in Spectral Italic, darunter „im Shop“ in der Textschrift;
// Farbe `--fox-text`, auf einem Papierzettel (`--paper`, damit er auf jedem Foto lesbar bleibt), Drehung +4° … +8° nach
// Objektnummer. Kein generisches Abzeichen. Bewusst nicht „neu“: die Textilien sind Second-Hand. Statisch, ohne Bewegung.
// `card`: oben rechts auf dem Kartenfoto, rein dekorativ (`aria-hidden`; der zugängliche Name der Karte nennt „frisch im
// Shop“). `page`: neben dem Preisschild der Produktseite, mit Text für Screenreader.

export type FreshStampSize = 'card' | 'page'

export function FreshStamp({
  itemNumber,
  locale,
  size = 'card',
  className,
}: {
  itemNumber: number
  locale: Locale
  size?: FreshStampSize
  className?: string
}) {
  const t = translatorFor(locale, 'shop.fresh')
  const angle = freshStampAngle(itemNumber)
  const classes = [styles.stamp, styles[size], className].filter(Boolean).join(' ')
  return (
    <span
      className={classes}
      style={{ '--fresh-angle': `${angle}deg` } as React.CSSProperties}
      data-fresh-stamp={size}
      data-angle={angle}
      aria-hidden={size === 'card' ? 'true' : undefined}
    >
      <svg
        className={styles.frame}
        viewBox={`0 0 ${STAMP_VIEWBOX.w} ${STAMP_VIEWBOX.h}`}
        preserveAspectRatio="none"
        focusable="false"
        aria-hidden="true"
      >
        {stampFramePaths(itemNumber + 101).map((d, i) => (
          <path key={i} d={d} />
        ))}
      </svg>
      <span className={styles.word} aria-hidden="true">
        {t('word')}
      </span>
      <span className={styles.rest} aria-hidden="true">
        {t('rest')}
      </span>
      {size === 'page' ? <span className="u-sr-only">{t('label')}</span> : null}
    </span>
  )
}
