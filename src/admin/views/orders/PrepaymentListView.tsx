import React from 'react'

import { MoneyAmount } from '@/components/shop/MoneyAmount'

import { StatusBadge } from '../../components/StatusBadge'
import { adminText } from '../../translations'
import type { AdminViewBodyProps } from '../AdminViewBody'
import { adminViewPath } from '../registry'
import { PrepaymentLateActions, PrepaymentOpenActions } from './PrepaymentActions'
import { loadPrepaymentList, type PrepaymentCard } from './prepaymentQuery'

// Ansicht „Vorkasse offen“ `/vorkasse` (PLAN P5.18, KONZEPT §7.7): `awaiting_prepayment`, Fälligste zuerst, mit
// Bestellnummer (= Verwendungszweck), Betrag, Bestelldatum, „noch X Tage bis Storno“ (am letzten Tag rot) und
// „Erinnerung verschickt“. Darunter „Kürzlich automatisch storniert (30 Tage)“ mit „Nachträglich bezahlt“ (O5).

function Deadline({ card }: { card: PrepaymentCard }) {
  if (card.daysLeft < 0) {
    return <StatusBadge tone="error">{adminText('orderActionsOverdue')}</StatusBadge>
  }
  if (card.daysLeft === 0) {
    return <StatusBadge tone="error">{adminText('orderActionsDueToday')}</StatusBadge>
  }
  return (
    <>
      {adminText(card.daysLeft === 1 ? 'orderActionsDaysLeftOne' : 'orderActionsDaysLeft', {
        days: card.daysLeft,
      })}{' '}
      <span className="pc-order__muted">
        ({adminText('prepaymentDueDate', { date: card.dueDate })})
      </span>
    </>
  )
}

export async function PrepaymentListView({ adminRoute, req }: AdminViewBodyProps) {
  const { open, cancelled } = await loadPrepaymentList(req, new Date())
  const templatesHref = `${adminRoute}${adminViewPath('texte')}`
  return (
    <div className="pc-order">
      <p role="status" className="pc-order__count" data-testid="prepayment-count">
        {open.length === 0
          ? adminText('prepaymentEmpty')
          : adminText(open.length === 1 ? 'prepaymentCountOne' : 'prepaymentCount', {
              count: open.length,
            })}
      </p>
      <ul className="pc-order__list" data-testid="prepayment-list">
        {open.map((card) => (
          <li
            key={card.id}
            className="pc-order__card"
            data-testid="prepayment-card"
            data-order-number={card.orderNumber}
            data-days-left={card.daysLeft}
          >
            <h2 className="pc-order__cardtitle">
              <a href={`${adminRoute}/bestellungen/${card.id}`} className="pc-admin-link">
                {card.orderNumber}
              </a>
            </h2>
            <p className="pc-order__meta">
              <strong>
                <MoneyAmount cents={card.totalCents} locale="de" />
              </strong>{' '}
              · {adminText('orderPlacedAt', { date: card.placedAt })}
            </p>
            <p className="pc-order__meta" data-testid="prepayment-deadline">
              <Deadline card={card} />
            </p>
            <p className="pc-order__meta" data-testid="prepayment-reminder">
              {card.reminderSent
                ? adminText('prepaymentReminderSent', { date: card.reminderSentAt ?? '' })
                : adminText('prepaymentReminderNotSent')}
            </p>
            <p className="pc-order__meta">{card.name}</p>
            <ul className="pc-order__items">
              {card.items.map((line, i) => (
                <li key={i} className="pc-order__item">
                  {line}
                </li>
              ))}
            </ul>
            <PrepaymentOpenActions
              orderId={card.id}
              orderNumber={card.orderNumber}
              totalCents={card.totalCents}
              bankText={card.bankText}
            />
          </li>
        ))}
      </ul>

      <section className="pc-order__section" aria-labelledby="prepayment-cancelled">
        <h2 id="prepayment-cancelled">{adminText('prepaymentRecentlyCancelled')}</h2>
        {cancelled.length === 0 ? (
          <p className="pc-order__muted" data-testid="prepayment-cancelled-empty">
            {adminText('prepaymentRecentlyCancelledEmpty')}
          </p>
        ) : (
          <ul className="pc-order__list" data-testid="prepayment-cancelled-list">
            {cancelled.map((card) => (
              <li
                key={card.id}
                className="pc-order__card"
                data-testid="prepayment-cancelled-card"
                data-order-number={card.orderNumber}
                data-all-available={card.allAvailable ? 'true' : 'false'}
              >
                <h3 className="pc-order__cardtitle">
                  <a href={`${adminRoute}/bestellungen/${card.id}`} className="pc-admin-link">
                    {card.orderNumber}
                  </a>
                </h3>
                <p className="pc-order__meta">
                  <strong>
                    <MoneyAmount cents={card.totalCents} locale="de" />
                  </strong>{' '}
                  · {adminText('orderPlacedAt', { date: card.placedAt })} ·{' '}
                  {adminText('prepaymentCancelledAt', { date: card.cancelledAt })}
                </p>
                <p className="pc-order__meta">{card.name}</p>
                <ul className="pc-order__items">
                  {card.items.map((line, i) => (
                    <li key={i} className="pc-order__item">
                      {line}
                    </li>
                  ))}
                </ul>
                <PrepaymentLateActions
                  orderId={card.id}
                  orderNumber={card.orderNumber}
                  allAvailable={card.allAvailable}
                  refundNoted={card.refundNoted}
                  templatesHref={templatesHref}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
