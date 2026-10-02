import React from 'react'

import { StatusBadge } from '../../components/StatusBadge'
import { adminText } from '../../translations'
import type { AdminViewBodyProps } from '../AdminViewBody'
import { adminViewPath } from '../registry'
import { loadShippedList } from './fulfillmentQuery'
import { ShippedActions } from './ShippedActions'

// Ansicht „Versendet“ `/versendet` (PLAN P5.16, KONZEPT §7.8): alle `shipped` und die `delivered` der letzten 30 Tage
// mit Versanddatum, Sendungsnummer als Link (sofern vorhanden) und Status; automatisch gesetzte Zustellung mit
// Kennzeichen „geschätzt“. Knöpfe „Zugestellt“ (O10), „Sendungsnummer korrigieren“/„nachtragen“ (Rückfrage
// „Versandmail erneut senden?“) und „Reklamation (Bruch)“ (bis P6: Sprung zu den Mail-Vorlagen unter „Texte“).

export async function ShippedListView({ adminRoute, req }: AdminViewBodyProps) {
  const cards = await loadShippedList(req, new Date())
  const complaintHref = `${adminRoute}${adminViewPath('texte')}`
  return (
    <div className="pc-order">
      <p role="status" className="pc-order__count" data-testid="shipped-count">
        {cards.length === 0
          ? adminText('shippedEmpty')
          : adminText(cards.length === 1 ? 'shippedCountOne' : 'shippedCount', {
              count: cards.length,
            })}
      </p>
      <ul className="pc-order__list" data-testid="shipped-list">
        {cards.map((card) => (
          <li
            key={card.id}
            className="pc-order__card"
            data-testid="shipped-card"
            data-order-number={card.orderNumber}
            data-status={card.status}
          >
            <h2 className="pc-order__cardtitle">
              <a href={`${adminRoute}/bestellungen/${card.id}`} className="pc-admin-link">
                {card.orderNumber}
              </a>
            </h2>
            <p className="pc-order__meta">
              {adminText('shippedAt', { date: card.shippedAt })}
              {card.carrierLabel ? ` · ${card.carrierLabel}` : ''} ·{' '}
              <StatusBadge tone={card.status === 'delivered' ? 'success' : 'neutral'}>
                {card.statusLabel}
              </StatusBadge>
              {card.deliveredAt ? (
                <>
                  {' '}
                  {adminText('shippedDeliveredAt', { date: card.deliveredAt })}
                  {card.estimated ? (
                    <>
                      {' '}
                      <StatusBadge tone="info">{adminText('shippedEstimated')}</StatusBadge>
                    </>
                  ) : null}
                </>
              ) : null}
            </p>
            <p className="pc-order__meta">{card.name}</p>
            <p className="pc-order__meta" data-testid="shipped-tracking">
              {card.trackingNumber ? (
                card.trackingUrl ? (
                  <a
                    href={card.trackingUrl}
                    className="pc-admin-link"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {adminText('shippedTrackingLink', { number: card.trackingNumber })}
                  </a>
                ) : (
                  card.trackingNumber
                )
              ) : (
                adminText('shippedNoTracking')
              )}
            </p>
            <ul className="pc-order__items">
              {card.items.map((line, i) => (
                <li key={i} className="pc-order__item">
                  {line}
                </li>
              ))}
            </ul>
            <ShippedActions
              orderId={card.id}
              orderNumber={card.orderNumber}
              status={card.status}
              carrier={card.carrier}
              trackingNumber={card.trackingNumber}
              complaintHref={complaintHref}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
