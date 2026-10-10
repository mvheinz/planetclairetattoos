import React from 'react'

import { translatorFor } from '@/i18n/translator'
import type { Locale } from '@/lib/enums'
import {
  WARRANTY_INFO_URL,
  WARRANTY_NOTICE_BLOCKS,
  WARRANTY_NOTICE_GRAPHIC,
  warrantyNoticeIsPlaceholder,
} from '@/lib/legal/warranty'

import styles from './WarrantyNotice.module.css'

// Harmonisierte Mitteilung zur gesetzlichen Gewährleistung (R-049) in hervorgehobener Weise: Grafik vom eigenen Origin
// mit Alt-Text, kurzer Text und Textlink auf die EU-Infoseite (auch für Screenreader), DE/EN. Keine eigene „Garantie“-
// Kennzeichnung und keine Werbung mit Selbstverständlichkeiten (V-19). Text der Mitteilung DE/EN nach Anhang I der DVO
// (EU) 2025/1960 (U-45, P13.6): Mindestdauer zwei Jahre, Rechte gegenüber dem Verkäufer, längere nationale Fristen,
// gebrauchte Waren. Solange Grafik oder Wortlaut Platzhalter sind, steht der Hinweis „Platzhalter-Fassung“ darunter
// (`data-placeholder`, Gate R-210). U-59 (P14.10): Wortlaut in Bausteinen (`WARRANTY_NOTICE_BLOCKS`), Grafik-Platz je
// Sprache (`WARRANTY_NOTICE_GRAPHIC`) – die amtliche Fassung wird nur dort eingesetzt, diese Komponente bleibt gleich.
// U-73 (P15.3): kompakt – kleine Grafik neben dem Text, der Kernsatz hervorgehoben, der übrige (amtliche, nicht gekürzte)
// Wortlaut als ein Absatz in kleiner Schrift; alles ohne Aufklappen sichtbar.
export function WarrantyNotice({ locale, className }: { locale: Locale; className?: string }) {
  const t = translatorFor(locale, 'shop.warranty')
  const graphic = WARRANTY_NOTICE_GRAPHIC[locale]
  const placeholder = warrantyNoticeIsPlaceholder()
  return (
    <section
      className={className ? `${styles.notice} ${className}` : styles.notice}
      aria-labelledby="warranty-notice-title"
      data-warranty-notice=""
      data-placeholder={placeholder ? 'true' : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- statische Grafik vom eigenen Origin, ohne Bildoptimierung (ARCHITEKTUR §9.4) */}
      <img
        src={graphic.src}
        width={graphic.width}
        height={graphic.height}
        alt={t('alt')}
        className={styles.graphic}
        data-warranty-graphic={graphic.placeholder ? 'placeholder' : 'official'}
        loading="lazy"
        decoding="async"
      />
      <div className={styles.body}>
        <h2 id="warranty-notice-title" className={styles.title}>
          {t('title')}
        </h2>
        {WARRANTY_NOTICE_BLOCKS.filter((block) => block.lead).map((block) => (
          <p
            key={block.key}
            className={styles.lead}
            data-warranty-lead=""
            data-warranty-block={block.key}
          >
            {t(`blocks.${block.key}`)}
          </p>
        ))}
        <p className={styles.text}>
          {WARRANTY_NOTICE_BLOCKS.filter((block) => !block.lead).map((block, i) => (
            <React.Fragment key={block.key}>
              {i > 0 ? ' ' : null}
              <span data-warranty-block={block.key}>{t(`blocks.${block.key}`)}</span>
            </React.Fragment>
          ))}
        </p>
        {placeholder ? (
          <p className={styles.note} data-warranty-placeholder="">
            {t('placeholderNote')}
          </p>
        ) : null}
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
