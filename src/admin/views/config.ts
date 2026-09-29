import type { AdminViewConfig } from 'payload'

import { ALL_ADMIN_VIEWS } from './registry'

// Registrierung der Ansichten-Registry als Payload-Custom-Views (PLAN P5.1): je Pfad eine exakte Route auf die
// gemeinsame Komponente `AdminView`; `ADMIN_ROUTE` selbst zeigt „Heute“ (Dashboard ersetzt).

const VIEW_COMPONENT = '/admin/views/AdminView#AdminView'
const DASHBOARD_COMPONENT = '/admin/views/AdminView#HeuteDashboard'

export function adminViewsConfig(): Record<string, AdminViewConfig> {
  const views: Record<string, AdminViewConfig> = {
    dashboard: { Component: DASHBOARD_COMPONENT, meta: { title: 'Heute' } },
  }
  for (const view of ALL_ADMIN_VIEWS) {
    views[view.key] = {
      Component: VIEW_COMPONENT,
      path: view.path,
      exact: true,
      meta: { title: view.title },
    }
  }
  return views
}
