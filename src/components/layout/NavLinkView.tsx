import React from 'react'

import { LinkUnderline } from '@/components/ui/LinkUnderline'

// Markup eines Navigationslinks (DESIGN KO-02/KO-03, MI-06) ohne Hooks: `NavLink` (Kopf, Client) berechnet
// `aria-current` aus der Route; das Menü rendert es als statisches HTML und das Modul `menu` setzt `aria-current` beim
// Öffnen (`data-route-id`).
export function NavLinkView({
  href,
  className,
  children,
  ariaCurrent,
  routeId,
  onClickClose,
}: {
  href: string
  className?: string
  children: React.ReactNode
  ariaCurrent?: 'page' | 'true'
  /** Nur im Menü: Route des Links für das Modul `menu`. */
  routeId?: string
  /** Markiert Links im Menü (schließt es beim Klick, Modul `menu`). */
  onClickClose?: boolean
}) {
  return (
    <a
      href={href}
      className={className}
      aria-current={ariaCurrent}
      data-underline-host=""
      data-menu-close={onClickClose ? '' : undefined}
      data-route-id={routeId}
    >
      <span className="nav-link__text">
        {children}
        <LinkUnderline seed={href} />
      </span>
    </a>
  )
}
