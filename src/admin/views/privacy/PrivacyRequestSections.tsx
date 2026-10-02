import React from 'react'

import { OPEN_PRIVACY_REQUEST_STATUSES } from '@/lib/privacy/deadlines'
import { formatBerlin } from '@/lib/time'
import type { Inquiry, Order, PrivacyRequest, PrivateUpload, Withdrawal } from '@/payload-types'

import { adminText } from '../../translations'
import type { AdminViewBodyProps } from '../AdminViewBody'
import { adminViewPath } from '../registry'
import { PrivacyAccessPanel } from './PrivacyAccessPanel'

// Werkzeuge einer Datenschutz-Anfrage unter den Eckdaten (PLAN P6.17–P6.19): Personensuche und Auskunft-Export,
// Löschen/Einschränken, Berichtigung, Einwilligungswiderruf und Mails zur Anfrage.

export interface PrivacyRequestSectionsProps extends AdminViewBodyProps {
  request: PrivacyRequest
  now: Date
}

const idsOf = (v: unknown): number[] =>
  Array.isArray(v)
    ? v
        .map((x) => (typeof x === 'object' && x ? (x as { id: number }).id : Number(x)))
        .filter((x) => Number.isSafeInteger(x))
    : []
const dt = (iso: string) => formatBerlin(new Date(iso), 'dd.MM.yyyy, HH:mm')

export async function PrivacyRequestSections(props: PrivacyRequestSectionsProps) {
  const { request: r, req, adminRoute } = props
  const closed = !(OPEN_PRIVACY_REQUEST_STATUSES as readonly string[]).includes(r.status)
  const find = async <T,>(collection: 'orders' | 'withdrawals' | 'inquiries', ids: number[]) =>
    ids.length === 0
      ? []
      : ((
          await req.payload.find({
            collection,
            where: { id: { in: ids } },
            depth: 0,
            pagination: false,
            overrideAccess: true,
            req,
          })
        ).docs as T[])
  const orders = await find<Order>('orders', idsOf(r.matchedOrders))
  const withdrawals = await find<Withdrawal>('withdrawals', idsOf(r.matchedWithdrawals))
  const inquiries = await find<Inquiry>('inquiries', idsOf(r.matchedInquiries))
  const exportId =
    typeof r.exportFile === 'object' && r.exportFile ? r.exportFile.id : (r.exportFile ?? null)
  const exportFile = exportId
    ? ((await req.payload.findByID({
        collection: 'private-uploads',
        id: exportId,
        depth: 0,
        overrideAccess: true,
        disableErrors: true,
        req,
      })) as PrivateUpload | null)
    : null
  const link = (path: string, label: string) => (
    <a href={`${adminRoute}${path}`} className="pc-admin-link">
      {label}
    </a>
  )

  return (
    <>
      <section className="pc-order__section" aria-labelledby="privacy-access-title">
        <h2 id="privacy-access-title">{adminText('privacyAccessTitle')}</h2>
        <PrivacyAccessPanel
          id={r.id}
          contactEmail={r.contactEmail}
          closed={closed}
          hasExport={exportFile !== null}
          identityVerified={r.identityVerified === true}
        />
        <h3>{adminText('privacyMatchesTitle')}</h3>
        {orders.length + withdrawals.length + inquiries.length === 0 ? (
          <p data-testid="privacy-matches-none">{adminText('privacyMatchesNone')}</p>
        ) : (
          <ul className="pc-order__list" data-testid="privacy-matches">
            {orders.map((o) => (
              <li key={`o${o.id}`} data-testid="privacy-match-order">
                {link(adminViewPath('bestellung', o.id), o.orderNumber)}
              </li>
            ))}
            {withdrawals.map((w) => (
              <li key={`w${w.id}`} data-testid="privacy-match-withdrawal">
                {link(adminViewPath('widerruf', w.id), w.reference)}
              </li>
            ))}
            {inquiries.map((i) => (
              <li key={`i${i.id}`} data-testid="privacy-match-inquiry">
                {link(adminViewPath('anfrage', i.id), i.reference)}
              </li>
            ))}
          </ul>
        )}
        {exportFile ? (
          <p data-testid="privacy-export-file">
            {adminText('privacyExportFile', { date: dt(exportFile.createdAt) })}{' '}
            {exportFile.url ? (
              <a href={exportFile.url} className="pc-admin-link" download>
                {adminText('privacyExportReview')}
              </a>
            ) : null}
          </p>
        ) : null}
      </section>
    </>
  )
}
