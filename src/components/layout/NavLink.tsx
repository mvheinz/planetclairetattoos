'use client'

import React from 'react'

import { NavLinkView } from './NavLinkView'
import { useCurrentRoute } from './useCurrentRoute'

// Navigationslink im Kopf (DESIGN KO-02): `--ink`, gezeichnete Unterstreichung (MI-06); aktuelle Seite
// `aria-current="page"`, aktiver Bereich (z. B. Shop bei Kategorie/Stück) `aria-current="true"` – beide statisch
// unterstrichen. Markup: `NavLinkView` (auch im Menü, dort ohne Hydrierung).
export function NavLink({
  href,
  routeId,
  area = [],
  className,
  children,
}: {
  href: string
  /** Route des Links. */
  routeId: string
  /** Weitere Routen, bei denen der Link als aktiver Bereich gilt. */
  area?: readonly string[]
  className?: string
  children: React.ReactNode
}) {
  const current = useCurrentRoute()?.route.id
  const ariaCurrent =
    current === routeId
      ? 'page'
      : current !== undefined && area.includes(current)
        ? 'true'
        : undefined
  return (
    <NavLinkView href={href} className={className} ariaCurrent={ariaCurrent}>
      {children}
    </NavLinkView>
  )
}
