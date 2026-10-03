'use client'

import { useConfig, useNav } from '@payloadcms/ui'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'

import { adminText } from '../translations'
import { ADMIN_BOTTOM_BAR, adminView, isActiveView } from '../views/registry'
import { AdminIcon } from './AdminIcon'
import { relativeAdminPath } from './adminNavPath'

// Leiste unten auf dem Handy (`admin.components.header`, PLAN P5.1, KONZEPT §7.2): „Heute · Neues Stück · Packen ·
// Mehr“. „Mehr“ öffnet Payloads Menü mit allen Ansichten und „Alle Daten“. Ab 1025 px ausgeblendet (dort steht die
// Seitenleiste; Payloads Umbruch liegt bei 1024 px). Tipp-Flächen ≥ 44 px, keine Animation.

/** Payloads Breakpoint `l`: bis hierhin ist die Seitenleiste ein Menü, das nach dem Laden geschlossen sein muss. */
const PAYLOAD_NAV_MODAL_QUERY = '(max-width: 1440px)'

export function AdminBottomBar() {
  const {
    config: {
      routes: { admin: adminRoute },
    },
  } = useConfig()
  const { navOpen, setNavOpen } = useNav()
  // Payload startet die Seitenleiste nach der gespeicherten Vorliebe (ohne Eintrag: offen) und schließt sie bis 1440 px
  // erst, nachdem die Fensterbreite gemessen ist. Dazwischen stand das Menü auf dem Handy kurz offen und schob den
  // Inhalt seitlich aus dem Bild. Deshalb vor dem ersten Zeichnen schließen (gleiche Grenze wie Payloads Breakpoint `l`).
  React.useLayoutEffect(() => {
    if (window.matchMedia(PAYLOAD_NAV_MODAL_QUERY).matches) setNavOpen(false)
  }, [setNavOpen])
  const current = relativeAdminPath(usePathname(), adminRoute)
  const items = ADMIN_BOTTOM_BAR.map((key) => adminView(key))

  return (
    <nav className="pc-admin-bottombar" aria-label={adminText('shellBottomBarLabel')}>
      <ul className="pc-admin-bottombar__list">
        {items.map((view) => {
          const active = !navOpen && isActiveView(view.key, current)
          return (
            <li key={view.key}>
              <Link
                href={`${adminRoute}${view.path}`}
                prefetch={false}
                className="pc-admin-bottombar__item"
                aria-current={active ? 'page' : undefined}
                onClick={() => setNavOpen(false)}
              >
                <AdminIcon name={view.icon} />
                <span>{view.short ?? view.title}</span>
              </Link>
            </li>
          )
        })}
        <li>
          <button
            type="button"
            className="pc-admin-bottombar__item"
            aria-expanded={navOpen}
            onClick={() => setNavOpen(!navOpen)}
            data-testid="admin-more"
          >
            <AdminIcon name="more" />
            <span>{adminText('shellMore')}</span>
          </button>
        </li>
      </ul>
    </nav>
  )
}
