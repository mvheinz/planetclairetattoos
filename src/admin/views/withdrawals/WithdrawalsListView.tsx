import React from 'react'

import { StatusBadge } from '../../components/StatusBadge'
import { adminText } from '../../translations'
import type { AdminViewBodyProps } from '../AdminViewBody'
import { adminViewPath } from '../registry'
import { loadWithdrawalList, type WithdrawalCard } from './withdrawalQuery'

// Ansicht „Widerrufe“ `/widerrufe` (PLAN P5.19, KONZEPT §7.10): offene Widerrufe (älteste zuerst) mit Vorgangsnummer,
// Eingang (Datum und Uhrzeit, Berlin), Name, Bestellung oder „nicht zugeordnet“, Kanal, Status und „erstatten bis“
// (Eingang + 14 Tage, ab Tag 10 rot); darunter die zuletzt erledigten. Nur lesend – Knöpfe ab P6.

function Card({ card, adminRoute }: { card: WithdrawalCard; adminRoute: string }) {
  return (
    <li
      className="pc-order__card"
      data-testid="withdrawal-card"
      data-reference={card.reference}
      data-status={card.status}
      data-urgent={card.refundUrgent ? 'true' : undefined}
    >
      <h3 className="pc-order__cardtitle">
        <a href={`${adminRoute}${adminViewPath('widerruf', card.id)}`} className="pc-admin-link">
          {card.reference}
        </a>
      </h3>
      <p className="pc-order__meta">
        {adminText('withdrawalReceived', { date: card.receivedAt })} · {card.channelLabel}
      </p>
      <p className="pc-order__meta">
        {card.name} ·{' '}
        <span data-testid="withdrawal-order">
          {card.orderNumber ?? (
            <StatusBadge tone="warning">{adminText('withdrawalUnmatched')}</StatusBadge>
          )}
        </span>
      </p>
      <p className="pc-order__meta">
        <StatusBadge tone={card.open ? 'info' : 'neutral'}>{card.statusLabel}</StatusBadge>
        {card.open ? (
          <>
            {' '}
            <span data-testid="withdrawal-refund-due">
              {card.refundUrgent ? (
                <StatusBadge tone="error">
                  {adminText('withdrawalRefundDue', { date: card.refundDue })}
                </StatusBadge>
              ) : (
                adminText('withdrawalRefundDue', { date: card.refundDue })
              )}
            </span>
          </>
        ) : null}
      </p>
    </li>
  )
}

export async function WithdrawalsListView({ adminRoute, req }: AdminViewBodyProps) {
  const { open, done } = await loadWithdrawalList(req, new Date())
  return (
    <div className="pc-order">
      <p className="pc-order__muted">{adminText('withdrawalNeverAuto')}</p>
      <section className="pc-order__section" aria-labelledby="withdrawals-open">
        <h2 id="withdrawals-open">{adminText('withdrawalsOpen')}</h2>
        <p role="status" className="pc-order__count" data-testid="withdrawals-count">
          {open.length === 0
            ? adminText('withdrawalsEmpty')
            : adminText(open.length === 1 ? 'withdrawalsCountOne' : 'withdrawalsCount', {
                count: open.length,
              })}
        </p>
        <ul className="pc-order__list" data-testid="withdrawals-open-list">
          {open.map((card) => (
            <Card key={card.id} card={card} adminRoute={adminRoute} />
          ))}
        </ul>
      </section>
      {done.length > 0 ? (
        <section className="pc-order__section" aria-labelledby="withdrawals-done">
          <h2 id="withdrawals-done">{adminText('withdrawalsDone')}</h2>
          <ul className="pc-order__list" data-testid="withdrawals-done-list">
            {done.map((card) => (
              <Card key={card.id} card={card} adminRoute={adminRoute} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
