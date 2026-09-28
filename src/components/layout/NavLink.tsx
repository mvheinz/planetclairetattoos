'use client'

import React from 'react'

import { LinkUnderline } from '@/components/ui/LinkUnderline'

import { useCurrentRoute } from './useCurrentRoute'

// Navigationslink in Kopf und Menü (DESIGN KO-02/KO-03): `--ink`, gezeichnete Unterstreichung (MI-06); aktuelle Seite
// `aria-current="page"`, aktiver Bereich (z. B. Shop bei Kategorie/Stück) `aria-current="true"` – beide statisch
// unterstrichen.
export function NavLink({
  href,
  routeId,
  area = [],
  className,
  children,
  onClickClose,
}: {
  href: string
  /** Route des Links. */
  routeId: string
  /** Weitere Routen, bei denen der Link als aktiver Bereich gilt. */
  area?: readonly string[]
  className?: string
  children: React.ReactNode
  /** Markiert Links im Menü (schließt es beim Klick, Modul `menu`). */
  onClickClose?: boolean
}) {
  const current = useCurrentRoute()?.route.id
  const ariaCurrent =
    current === routeId
      ? 'page'
      : current !== undefined && area.includes(current)
        ? 'true'
        : undefined
  return (
    <a
      href={href}
      className={className}
      aria-current={ariaCurrent}
      data-underline-host=""
      data-menu-close={onClickClose ? '' : undefined}
    >
      <span className="nav-link__text">
        {children}
        <LinkUnderline seed={href} />
      </span>
    </a>
  )
}
