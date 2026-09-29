import { useTranslations } from 'next-intl'
import React from 'react'

import type { Locale } from '@/lib/enums'
import { WARRANTY_INFO_URL, WARRANTY_NOTICE_GRAPHIC } from '@/lib/legal/warranty'

import styles from './WarrantyNotice.module.css'

// Harmonisierte Mitteilung zur gesetzlichen Gewährleistung (R-049) in hervorgehobener Weise: Grafik vom eigenen Origin
// mit Alt-Text, kurzer Text und Textlink auf die EU-Infoseite (auch für Screenreader), DE/EN. Keine eigene „Garantie“-
// Kennzeichnung und keine Werbung mit Selbstverständlichkeiten (V-19). Solange die amtliche Grafik fehlt, zeigt die
// Grafik den Platzhalter (`data-placeholder`, Gate R-210).
export function WarrantyNotice({ locale, className }: { locale: Locale; className?: string }) {
  const t = useTranslations('shop.warranty')
  const graphic = WARRANTY_NOTICE_GRAPHIC[locale]
  return (
    <section
      className={className ? `${styles.notice} ${className}` : styles.notice}
      aria-labelledby="warranty-notice-title"
      data-warranty-notice=""
      data-placeholder={graphic.placeholder ? 'true' : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- statische Grafik vom eigenen Origin, ohne Bildoptimierung (ARCHITEKTUR §9.4) */}
      <img
        src={graphic.src}
        width={graphic.width}
        height={graphic.height}
        alt={t('alt')}
        className={styles.graphic}
        loading="lazy"
        decoding="async"
      />
      <div className={styles.body}>
        <h2 id="warranty-notice-title" className={styles.title}>
          {t('title')}
        </h2>
        <p className={styles.text}>{t('text')}</p>
        <a
          href={WARRANTY_INFO_URL[locale]}
          className={styles.link}
          hrefLang={locale}
          rel="noopener"
        >
          {t('link')}
        </a>
      </div>
    </section>
  )
}
