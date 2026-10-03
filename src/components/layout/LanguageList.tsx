import React from 'react'

import { LOCALES, type Locale } from '@/lib/routes/registry'

import styles from './LanguageSwitcher.module.css'

// Markup des Sprachumschalters „Deutsch · English“ ohne Hooks (KONZEPT §2.6, DESIGN KO-03/KO-04): die aktuelle Sprache
// als Text mit `aria-current`, die andere als Link mit `hreflang` und `lang`. Sprachnamen in der eigenen Sprache.
// `LanguageSwitcher` (Fuß, Client) setzt das Ziel aus der Route; im Menü (statisches HTML) übernimmt das Modul `menu`
// beim Öffnen das Ziel des Fuß-Umschalters.
export const LANGUAGE_NAMES: Record<Locale, string> = { de: 'Deutsch', en: 'English' }

export function LanguageList({
  locale,
  hrefFor,
  label,
  className,
  linkClassName,
}: {
  locale: Locale
  /** Ziel des Links auf die andere Sprache. */
  hrefFor: (l: Locale) => string
  /** Zugänglicher Name der Liste („Sprache“). */
  label: string
  className?: string
  linkClassName?: string
}) {
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
            <a href={hrefFor(l)} hrefLang={l} className={linkClassName}>
              {LANGUAGE_NAMES[l]}
            </a>
          )}
        </li>
      ))}
    </ul>
  )
}
