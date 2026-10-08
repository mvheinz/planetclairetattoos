'use client'

import React from 'react'

import { LOCALES, type Locale } from '@/lib/routes/registry'

import styles from './SiteHeader.module.css'
import { useAlternateHref } from './useAlternateHref'

// Sprach-Umschalter „DE | EN“ in der Kopfleiste rechts neben „Menü“ (U-47, P13.8): in der Schrift der Kopf-Links, die
// aktive Sprache mit einer kleinen Tusche-Linie unterstrichen (Inline-SVG, `currentColor`). Ein Link auf dieselbe Seite
// in der anderen Sprache (Ziel wie im Fuß: `useAlternateHref`) – eine Zielfläche ≥ 44 × 44 px, damit die Kopfleiste
// bis 320 px nicht umbricht. Zugänglicher Name in der Zielsprache („Language: English“ bzw. „Sprache: Deutsch“).

/** Zugänglicher Name des Links je Zielsprache (in der Zielsprache, `lang` am Link). */
export const LANGUAGE_SWITCH_LABEL: Record<Locale, string> = {
  de: 'Sprache: Deutsch',
  en: 'Language: English',
}

const CODE: Record<Locale, string> = { de: 'DE', en: 'EN' }

export function HeaderLanguageSwitch({ locale }: { locale: Locale }) {
  const hrefFor = useAlternateHref()
  const target = LOCALES.find((l) => l !== locale) ?? locale
  return (
    <a
      href={hrefFor(target)}
      hrefLang={target}
      lang={target}
      aria-label={LANGUAGE_SWITCH_LABEL[target]}
      className={`${styles.link} ${styles.lang}`}
      data-header-language=""
      data-language-switcher-link=""
    >
      {LOCALES.map((l, i) => (
        <React.Fragment key={l}>
          {i > 0 ? (
            <span aria-hidden="true" className={styles.langSep}>
              |
            </span>
          ) : null}
          <span
            className={styles.langCode}
            data-active={l === locale ? '' : undefined}
            lang={l}
            aria-hidden="true"
          >
            {CODE[l]}
            {l === locale ? (
              <svg
                className={styles.langInk}
                viewBox="0 0 24 6"
                preserveAspectRatio="none"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M1 3.6c3.1-1.2 6.4-1.5 9.6-.8 2.6.6 5.1.4 7.6-.5 1.7-.6 3.2-.7 4.8-.2" />
              </svg>
            ) : null}
          </span>
        </React.Fragment>
      ))}
    </a>
  )
}
