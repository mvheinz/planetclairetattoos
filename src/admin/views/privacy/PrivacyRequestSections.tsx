import React from 'react'

import { OPEN_PRIVACY_REQUEST_STATUSES } from '@/lib/privacy/deadlines'
import { buildErasurePlan } from '@/lib/privacy/erasure'
import { formatBerlin } from '@/lib/time'
import type { Inquiry, Order, PrivacyRequest, PrivateUpload, Withdrawal } from '@/payload-types'

import { adminText } from '../../translations'
import type { AdminViewBodyProps } from '../AdminViewBody'
import { adminViewPath } from '../registry'
import { PrivacyAccessPanel } from './PrivacyAccessPanel'
import { PrivacyErasurePanel, PrivacyRectifyPanel } from './PrivacyErasurePanel'

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
const day = (iso: string | null) => (iso ? formatBerlin(new Date(iso), 'dd.MM.yyyy') : null)

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
  const plan = closed ? [] : await buildErasurePlan(req, r, { email: r.contactEmail }, props.now)
  const rectifiable = orders.filter((o) => !o.privacy?.anonymizedAt)
  const consentOrders = orders.filter(
    (o) => o.carrierEmailConsent && !o.carrierEmailConsentRevokedAt,
  )
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
      {!closed ? (
        <section className="pc-order__section" aria-labelledby="privacy-erasure-title">
          <h2 id="privacy-erasure-title">{adminText('privacyErasureTitle')}</h2>
          <p className="pc-order__muted">{adminText('privacyErasureHint')}</p>
          {plan.length === 0 ? (
            <p>{adminText('privacyErasureNone')}</p>
          ) : (
            <PrivacyErasurePanel
              id={r.id}
              rows={plan.map((p) => ({
                key: `${p.collection}:${p.id}`,
                collection: p.collection,
                id: p.id,
                area: p.area,
                label: p.label,
                ruleId: p.ruleId,
                until: day(p.until),
                note: p.note,
                actions: p.actions,
                suggested: p.suggested,
              }))}
            />
          )}
          {r.identityVerified !== true ? (
            <p className="pc-order__muted">{adminText('privacySendAccessIdentity')}</p>
          ) : null}
        </section>
      ) : null}
      {!closed && rectifiable.length > 0 ? (
        <section className="pc-order__section" aria-labelledby="privacy-rectify-title">
          <h2 id="privacy-rectify-title">{adminText('privacyRectifyTitle')}</h2>
          <p className="pc-order__muted">{adminText('privacyRectifyHint')}</p>
          <PrivacyRectifyPanel
            id={r.id}
            orders={rectifiable.map((o) => ({
              id: o.id,
              orderNumber: o.orderNumber,
              name: o.customer?.name ?? '',
              email: o.customer?.email ?? '',
              street: o.shippingAddress?.addressLine1 ?? '',
              postalCode: o.shippingAddress?.postalCode ?? '',
              city: o.shippingAddress?.city ?? '',
            }))}
          />
        </section>
      ) : null}
      <section className="pc-order__section" aria-labelledby="privacy-consent-title">
        <h2 id="privacy-consent-title">{adminText('privacyConsentTitle')}</h2>
        <p className="pc-order__muted">{adminText('privacyConsentHint')}</p>
        {consentOrders.length === 0 ? (
          <p>{adminText('privacyConsentNone')}</p>
        ) : (
          <ul className="pc-order__list" data-testid="privacy-consents">
            {consentOrders.map((o) => (
              <li key={o.id}>
                {link(
                  adminViewPath('bestellung', o.id),
                  `${o.orderNumber}: ${adminText('privacyConsentActive')}`,
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
