'use client'

import React from 'react'

import { alternateForMatch } from '@/lib/routes/paths'
import type { Locale } from '@/lib/routes/registry'

import { useCurrentRoute } from './useCurrentRoute'

// Link auf die aktuelle Seite in einer anderen Sprache (U-47): nur das Ziel kommt aus der Route (`alternateForMatch`,
// auf Server und Client gleich); Inhalt und Gestaltung rendert der Server (`HeaderLanguageSwitch`) – so bleibt das
// Erstlade-JS klein.
export function AlternateLink({
  target,
  children,
  ...rest
}: { target: Locale; children: React.ReactNode } & Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  'href' | 'hrefLang' | 'lang'
>) {
  return (
    <a
      {...rest}
      href={alternateForMatch(useCurrentRoute(), target)}
      hrefLang={target}
      lang={target}
    >
      {children}
    </a>
  )
}
