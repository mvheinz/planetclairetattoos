import { DefaultTemplate } from '@payloadcms/next/templates'
import { notFound, redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import React from 'react'

import { AdminViewBody, type AdminViewBodyProps } from './AdminViewBody'
import { matchAdminView } from './registry'

// Payload-Custom-View für alle Pfade der Ansichten-Registry (PLAN P5.1, `admin.components.views`). Payload behandelt
// eigene Ansichten als öffentlich (keine Anmelde-Weiterleitung) und rendert sie ohne Rahmen – beides übernimmt diese
// Komponente: ohne Sitzung → Anmeldeseite mit Rücksprung, sonst Payloads Standard-Rahmen (Navigation, Kopfzeile).

function segmentsOf(params: AdminViewServerProps['params']): string[] {
  const raw = params?.segments
  return Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : []
}

export function AdminView(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props
  const { req, permissions, visibleEntities, locale } = initPageResult
  const adminRoute = req.payload.config.routes.admin
  const segments = segmentsOf(params)

  if (!req.user || !permissions.canAccessAdmin) {
    const back = `${adminRoute}/${segments.map(encodeURIComponent).join('/')}`
    redirect(`${adminRoute}/login?redirect=${encodeURIComponent(back)}`)
  }
  const match = matchAdminView(segments)
  if (!match) notFound()

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={locale}
      params={params}
      payload={req.payload}
      permissions={permissions}
      req={req}
      searchParams={searchParams}
      user={req.user}
      viewType={undefined}
      visibleEntities={{
        collections: visibleEntities?.collections,
        globals: visibleEntities?.globals,
      }}
    >
      <AdminViewBody
        match={match}
        adminRoute={adminRoute}
        req={req}
        searchParams={searchParams as AdminViewBodyProps['searchParams']}
      />
    </DefaultTemplate>
  )
}

/** Startseite `ADMIN_ROUTE` (ersetzt Payloads Dashboard; der Rahmen kommt dort von Payload): „Heute“. */
export function HeuteDashboard(props: AdminViewServerProps) {
  const { req } = props.initPageResult
  return (
    <AdminViewBody
      match={matchAdminView([])!}
      adminRoute={req.payload.config.routes.admin}
      req={req}
      searchParams={props.searchParams as AdminViewBodyProps['searchParams']}
    />
  )
}
