import { Gutter, SetStepNav } from '@payloadcms/ui'
import Link from 'next/link'
import type { PayloadRequest } from 'payload'
import React from 'react'

import { Notice } from '../components/Notice'
import { adminText } from '../translations'
import { OrderDetailView } from './orders/OrderDetailView'
import { PackingListView } from './orders/PackingListView'
import { PickupListView } from './orders/PickupListView'
import { PrepaymentListView } from './orders/PrepaymentListView'
import { ShippedListView } from './orders/ShippedListView'
import { ExportView } from './export/ExportView'
import { PieceEditorView } from './pieces/PieceEditorView'
import { PiecesListView } from './pieces/PiecesListView'
import { ProductSafetyView } from './settings/ProductSafetyView'
import { WithdrawalDetailView } from './withdrawals/WithdrawalDetailView'
import { WithdrawalsListView } from './withdrawals/WithdrawalsListView'
import { ADMIN_HOME_VIEW, adminView, allDataPath, type AdminViewMatch } from './registry'

// Inhalt einer Verwaltungs-Ansicht (PLAN P5.1). Bis die Aufgabe der Ansicht (`task` in der Registry) sie füllt, zeigt
// sie einen Platzhalter mit Link in „Alle Daten“ – so funktionieren auch die Direktlinks der Verwaltungs-Mails schon
// heute. „Tattoo“ zeigt bis P7 „kommt in P7“. Die Aufgaben ersetzen den Platzhalter über `VIEW_BODIES`.

export interface AdminViewBodyProps {
  match: AdminViewMatch
  adminRoute: string
  /** Anfrage der angemeldeten Verwaltung (Payload, Nutzer). */
  req: PayloadRequest
  searchParams?: Record<string, string | string[] | undefined>
}

type ViewBody = (props: AdminViewBodyProps) => React.ReactNode | Promise<React.ReactNode>

/** Fertige Ansichten je Registry-Schlüssel (von den Aufgaben P5.4 ff. ergänzt). */
const VIEW_BODIES: Partial<Record<string, ViewBody>> = {
  'neues-stueck': PieceEditorView,
  stueck: PieceEditorView,
  stuecke: PiecesListView,
  packen: PackingListView,
  vorkasse: PrepaymentListView,
  versendet: ShippedListView,
  abholung: PickupListView,
  bestellung: OrderDetailView,
  export: ExportView,
  widerrufe: WithdrawalsListView,
  widerruf: WithdrawalDetailView,
  produktsicherheit: ProductSafetyView,
}

export function AdminViewBody(props: AdminViewBodyProps) {
  const { match, adminRoute } = props
  const { view, id } = match
  const Body = VIEW_BODIES[view.key]
  const parent = view.parent ? adminView(view.parent) : null
  const title = id ? `${view.title} ${id}` : view.title
  const nav = parent
    ? [{ label: parent.title, url: `${adminRoute}${parent.path}` }, { label: title }]
    : [{ label: title }]

  return (
    <Gutter
      // `pc-admin-dashboard`: Startseite erkennbar wie früher Payloads Dashboard (E2E-Fixture `adminPage`).
      className={
        view.key === ADMIN_HOME_VIEW ? 'pc-admin-view pc-admin-dashboard' : 'pc-admin-view'
      }
    >
      <SetStepNav nav={nav} />
      <h1 className="pc-admin-view__title">{title}</h1>
      {Body ? (
        <Body {...props} />
      ) : (
        <>
          <Notice
            tone="info"
            action={{
              href: `${adminRoute}${allDataPath(view, id)}`,
              label: adminText('shellOpenAllData'),
            }}
            data-testid="admin-view-placeholder"
          >
            {view.phase > 5
              ? adminText('shellComesInPhase', { phase: view.phase })
              : adminText('shellInProgress')}
          </Notice>
          {view.key === 'heute' ? (
            <p>
              <Link
                href={`${adminRoute}${adminView('neues-stueck').path}`}
                prefetch={false}
                className="pc-admin-btn pc-admin-btn--primary"
              >
                {adminText('shellNewPiece')}
              </Link>
            </p>
          ) : null}
          {view.key === 'einstellungen' ? (
            <p>
              <Link
                href={`${adminRoute}${adminView('produktsicherheit').path}`}
                prefetch={false}
                className="pc-admin-btn pc-admin-btn--secondary"
                data-testid="settings-product-safety"
              >
                {adminText('settingsProductSafety')}
              </Link>
            </p>
          ) : null}
        </>
      )}
    </Gutter>
  )
}
