import React from 'react'

import { StatusBadge } from '../../components/StatusBadge'
import { adminText } from '../../translations'
import type { AdminViewBodyProps } from '../AdminViewBody'
import { loadPickupList } from './fulfillmentQuery'
import { PickupActions } from './PickupActions'

// Ansicht „Abholung“ `/abholung` (PLAN P5.17, KONZEPT §7.9): bezahlte Abholbestellungen und `ready_for_pickup` mit
// Wartetagen (mehr als 14 Tage markiert). „Bereit zur Abholung“ mit vorbelegtem, editierbarem Abholtext (O8, M07),
// „Abgeholt“ (O9, Beginn von Widerrufsfrist und Gewährleistung). Nach Teil-Widerruf bzw. Teil-Erstattung vor der
// Abholung nur die Stücke, die übergeben werden, und rot die übrigen; Teil-Widerruf nur im Freitext sperrt die Knöpfe.

export async function PickupListView({ adminRoute, req }: AdminViewBodyProps) {
  const cards = await loadPickupList(req, new Date())
  return (
    <div className="pc-order">
      <p role="status" className="pc-order__count" data-testid="pickup-count">
        {cards.length === 0
          ? adminText('pickupEmpty')
          : adminText(cards.length === 1 ? 'pickupCountOne' : 'pickupCount', {
              count: cards.length,
            })}
      </p>
      <ul className="pc-order__list" data-testid="pickup-list">
        {cards.map((card) => (
          <li
            key={card.id}
            className="pc-order__card"
            data-testid="pickup-card"
            data-order-number={card.orderNumber}
            data-status={card.status}
            data-overdue={card.overdue ? 'true' : undefined}
          >
            <h2 className="pc-order__cardtitle">
              <a href={`${adminRoute}/bestellungen/${card.id}`} className="pc-admin-link">
                {card.orderNumber}
              </a>
            </h2>
            <p className="pc-order__meta">
              {adminText('orderPlacedAt', { date: card.placedAt })} ·{' '}
              <StatusBadge tone={card.status === 'ready_for_pickup' ? 'info' : 'neutral'}>
                {card.statusLabel}
              </StatusBadge>
            </p>
            <p className="pc-order__meta" data-testid="pickup-waiting">
              {card.overdue ? (
                <StatusBadge tone="warning">
                  {adminText('pickupOverdue', { days: card.waitingDays })}
                </StatusBadge>
              ) : (
                adminText(card.waitingDays === 1 ? 'pickupWaitingOne' : 'pickupWaiting', {
                  days: card.waitingDays,
                })
              )}
            </p>
            <p className="pc-order__meta">{card.name}</p>
            <ul className="pc-order__items">
              {card.items.map((line, i) => (
                <li key={i} className="pc-order__item">
                  {line}
                </li>
              ))}
            </ul>
            {card.warnings.length > 0 ? (
              <ul className="pc-order__hints" data-testid="pickup-warnings">
                {card.warnings.map((text) => (
                  <li key={text}>
                    <StatusBadge tone="error">{text}</StatusBadge>
                  </li>
                ))}
              </ul>
            ) : null}
            {card.blocked ? null : (
              <PickupActions
                orderId={card.id}
                orderNumber={card.orderNumber}
                step={card.step}
                template={card.template}
                messageText={card.messageText}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
