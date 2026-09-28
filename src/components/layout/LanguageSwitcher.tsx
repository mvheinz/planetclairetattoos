'use client'

import React from 'react'

import { alternateForMatch } from '@/lib/routes/paths'
import { LOCALES, type Locale } from '@/lib/routes/registry'

import styles from './LanguageSwitcher.module.css'
import { useCurrentRoute } from './useCurrentRoute'

// Sprachumschalter „Deutsch · English“ (KONZEPT §2.6, DESIGN KO-03/KO-04): die aktuelle Sprache als Text mit
// `aria-current`, die andere als Link auf das Gegenstück (`alternatePath`; dynamische Routen ohne Gegenstück → Startseite
// der anderen Sprache) mit `hreflang` und `lang`. Sprachnamen in der eigenen Sprache.
export const LANGUAGE_NAMES: Record<Locale, string> = { de: 'Deutsch', en: 'English' }

export function LanguageSwitcher({
  locale,
  label,
  className,
  linkClassName,
}: {
  locale: Locale
  /** Zugänglicher Name der Liste („Sprache“). */
  label: string
  className?: string
  linkClassName?: string
}) {
  const match = useCurrentRoute()
  return (
    <ul className={className} aria-label={label} data-language-switcher="">
      {LOCALES.map((l, i) => (
        <li key={l} lang={l}>
          {i > 0 ? (
            <span aria-hidden="true" className={styles.sep}>
              ·
            </span>
          ) : null}
          {l === locale ? (
            <span aria-current="true">{LANGUAGE_NAMES[l]}</span>
          ) : (
            <a href={alternateForMatch(match, l)} hrefLang={l} className={linkClassName}>
              {LANGUAGE_NAMES[l]}
            </a>
          )}
        </li>
      ))}
    </ul>
  )
}
