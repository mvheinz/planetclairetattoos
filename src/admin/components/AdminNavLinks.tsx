'use client'

import { useConfig } from '@payloadcms/ui'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'

import { adminText } from '../translations'
import { ADMIN_VIEWS, isActiveView } from '../views/registry'
import { AdminIcon } from './AdminIcon'
import { relativeAdminPath } from './adminNavPath'

// Ansichten in der Payload-Navigation (`admin.components.beforeNavLinks`, PLAN P5.1, KONZEPT §7.2): ab 1025 px die
// Seitenleiste, auf dem Handy das Menü hinter „Mehr“. Darunter folgen Payloads Sammlungen unter der Überschrift
// „Alle Daten“ (Standard-Ansichten, KONZEPT §7.16).

export function AdminNavLinks() {
  const {
    config: {
      routes: { admin: adminRoute },
    },
  } = useConfig()
  const current = relativeAdminPath(usePathname(), adminRoute)

  return (
    <div className="pc-admin-nav" data-testid="admin-nav-views">
      <p className="pc-admin-nav__heading">{adminText('shellViewsHeading')}</p>
      <ul className="pc-admin-nav__list">
        {ADMIN_VIEWS.map((view) => {
          const active = isActiveView(view.key, current)
          return (
            <li key={view.key}>
              <Link
                href={`${adminRoute}${view.path}`}
                prefetch={false}
                className="pc-admin-nav__link"
                aria-current={active ? 'page' : undefined}
              >
                <AdminIcon name={view.icon} />
                <span>{view.title}</span>
              </Link>
            </li>
          )
        })}
      </ul>
      <p className="pc-admin-nav__heading pc-admin-nav__heading--data" id="pc-admin-all-data">
        {adminText('shellAllData')}
      </p>
    </div>
  )
}
