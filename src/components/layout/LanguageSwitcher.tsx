'use client'

import React from 'react'

import { alternateForMatch } from '@/lib/routes/paths'
import type { Locale } from '@/lib/routes/registry'

import { LanguageList } from './LanguageList'
import { useCurrentRoute } from './useCurrentRoute'

// Sprachumschalter im Fuß (KONZEPT §2.6, DESIGN KO-04): Ziel ist das Gegenstück der aktuellen Seite (`alternatePath`;
// dynamische Routen ohne Gegenstück → Startseite der anderen Sprache). Markup: `LanguageList`.

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
    <LanguageList
      locale={locale}
      hrefFor={(l) => alternateForMatch(match, l)}
      label={label}
      className={className}
      linkClassName={linkClassName}
    />
  )
}
