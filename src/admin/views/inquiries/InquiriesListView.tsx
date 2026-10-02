import React from 'react'

import { Notice } from '../../components/Notice'
import { StatusBadge } from '../../components/StatusBadge'
import { adminText } from '../../translations'
import type { AdminViewBodyProps } from '../AdminViewBody'
import { adminViewPath } from '../registry'
import { loadInquiryList } from './inquiryQuery'

// Ansicht „Anfragen“ `/anfragen` (PLAN P5.20, KONZEPT §7.11): Referenz `AA-…`, Datum, Name, Gegenstand, Status und
// „wird gelöscht am {deleteAfter}“ (Eingang + 6 Monate, L-10). Neue Anfragen hervorgehoben.

export async function InquiriesListView({ adminRoute, req, searchParams }: AdminViewBodyProps) {
  const cards = await loadInquiryList(req)
  const deleted = typeof searchParams?.geloescht === 'string' ? searchParams.geloescht : null
  return (
    <div className="pc-order">
      {deleted ? (
        <Notice tone="success" data-testid="inquiry-deleted">
          {adminText('inquiryDeleted', { reference: deleted })}
        </Notice>
      ) : null}
      <p role="status" className="pc-order__count" data-testid="inquiries-count">
        {cards.length === 0
          ? adminText('inquiriesEmpty')
          : adminText(cards.length === 1 ? 'inquiriesCountOne' : 'inquiriesCount', {
              count: cards.length,
            })}
      </p>
      <ul className="pc-order__list" data-testid="inquiries-list">
        {cards.map((card) => (
          <li
            key={card.id}
            className="pc-order__card"
            data-testid="inquiry-card"
            data-reference={card.reference}
            data-status={card.status}
          >
            <h2 className="pc-order__cardtitle">
              <a
                href={`${adminRoute}${adminViewPath('anfrage', card.id)}`}
                className="pc-admin-link"
              >
                {card.reference}
              </a>
            </h2>
            <p className="pc-order__meta">
              {card.createdAt} · {card.name}
            </p>
            <p className="pc-order__meta">
              {card.objectLabel} ·{' '}
              <StatusBadge tone={card.status === 'new' ? 'info' : 'neutral'}>
                {card.statusLabel}
              </StatusBadge>
            </p>
            <p className="pc-order__muted" data-testid="inquiry-delete-after">
              {adminText('inquiryDeleteAfter', { date: card.deleteAfter })}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
