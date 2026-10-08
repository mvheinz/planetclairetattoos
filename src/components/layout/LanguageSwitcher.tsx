'use client'

import React from 'react'

import type { Locale } from '@/lib/routes/registry'

import { LanguageList } from './LanguageList'
import { useAlternateHref } from './useAlternateHref'

// Sprachumschalter im Fuß (KONZEPT §2.6, DESIGN KO-04): Ziel ist das Gegenstück der aktuellen Seite (`useAlternateHref`:
// Registry-Route, bei Kategorie/Stück die hreflang-Alternativen der Seite; sonst Startseite der anderen Sprache) –
// gleiches Ziel wie der Umschalter „DE | EN“ in der Kopfleiste (U-47). Markup: `LanguageList`.

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
  const hrefFor = useAlternateHref()
  return (
    <LanguageList
      locale={locale}
      hrefFor={hrefFor}
      label={label}
      className={className}
      linkClassName={linkClassName}
    />
  )
}
