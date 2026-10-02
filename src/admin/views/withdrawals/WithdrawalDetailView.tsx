import React from 'react'

import { MoneyAmount } from '@/components/shop/MoneyAmount'

import { NotesEditor } from '../../components/NotesEditor'
import { Notice } from '../../components/Notice'
import { StatusBadge } from '../../components/StatusBadge'
import { adminText } from '../../translations'
import type { AdminViewBodyProps } from '../AdminViewBody'
import { adminViewPath } from '../registry'
import { ENUM_LABELS } from '@/lib/enumLabels'
import { WITHDRAWAL_CLOSE_REASONS } from '@/lib/enums'

import { refundDialogData } from '@/lib/commerce/refundOrder'

import { RefundDialog } from '../orders/RefundDialog'
import { WithdrawalActions } from './WithdrawalActions'
import { loadWithdrawalDetail } from './withdrawalQuery'

// Widerruf-Detail `/widerrufe/:id` (PLAN P5.19, KONZEPT §7.10): unveränderliche Erklärung (Snapshot beim Eingang,
// DM-WDR-03), zugeordnete Bestellung mit Positionen und Zahlart, Info zur regulären Widerrufsfrist (nie automatisch
// ablehnen, R-094), interne Notizen (separat speicherbar), Aktionen (P6.9) und „Erstatten“ (P6.10).

export const WITHDRAWAL_NOTES_MAX = 2000

export async function WithdrawalDetailView({ adminRoute, req, match }: AdminViewBodyProps) {
  const detail = match.id ? await loadWithdrawalDetail(req, Number(match.id), new Date()) : null
  if (!detail) {
    return (
      <Notice
        tone="info"
        data-testid="withdrawal-not-found"
        action={{
          href: `${adminRoute}${adminViewPath('widerrufe')}`,
          label: adminText('withdrawalBack'),
        }}
      >
        {adminText('withdrawalNotFound')}
      </Notice>
    )
  }
  const { card, declaration: d, order } = detail
  const refund =
    order && ['received', 'goods_returned', 'partially_refunded'].includes(card.status)
      ? await refundDialogData(req, order.id, { affectedItemIds: detail.affectedItemIds })
      : null
  return (
    <div className="pc-order pc-order--detail" data-testid="withdrawal-detail">
      <p className="pc-order__meta">
        <span className="pc-order__nr" data-testid="withdrawal-reference">
          {card.reference}
        </span>{' '}
        · <StatusBadge tone={card.open ? 'info' : 'neutral'}>{card.statusLabel}</StatusBadge>
        {card.open ? (
          <>
            {' '}
            <StatusBadge tone={card.refundUrgent ? 'error' : 'neutral'}>
              {adminText('withdrawalRefundDue', { date: card.refundDue })}
            </StatusBadge>
          </>
        ) : null}
      </p>

      <section className="pc-order__section" aria-labelledby="withdrawal-declaration">
        <h2 id="withdrawal-declaration">{adminText('withdrawalDeclaration')}</h2>
        <p className="pc-order__muted">{adminText('withdrawalImmutable')}</p>
        <dl className="pc-order__facts" data-testid="withdrawal-declaration">
          <dt>{adminText('withdrawalReceivedLabel')}</dt>
          <dd>{d.receivedAt}</dd>
          <dt>{adminText('withdrawalChannel')}</dt>
          <dd>{d.channelLabel}</dd>
          <dt>{adminText('withdrawalName')}</dt>
          <dd>{d.name}</dd>
          <dt>{adminText('withdrawalEmail')}</dt>
          <dd>{d.email ?? '–'}</dd>
          <dt>{adminText('withdrawalContract')}</dt>
          <dd className="pc-order__notes">{d.contractIdentification}</dd>
          <dt>{adminText('withdrawalItems')}</dt>
          <dd className="pc-order__notes">{d.itemsText || '–'}</dd>
          <dt>{adminText('withdrawalReason')}</dt>
          <dd className="pc-order__notes">{d.reason || '–'}</dd>
          <dt>{adminText('withdrawalLanguage')}</dt>
          <dd>{d.localeLabel}</dd>
        </dl>
      </section>

      <section className="pc-order__section" aria-labelledby="withdrawal-order">
        <h2 id="withdrawal-order">{adminText('withdrawalOrder')}</h2>
        {order ? (
          <>
            <p className="pc-order__meta">
              <a
                className="pc-admin-link"
                href={`${adminRoute}${adminViewPath('bestellung', order.id)}`}
                data-testid="withdrawal-order-link"
              >
                {order.orderNumber}
              </a>{' '}
              · {order.statusLabel} · {card.matchLabel}
            </p>
            <ul className="pc-order__items">
              {order.items.map((item, i) => (
                <li key={i} className="pc-order__item">
                  <span className="pc-order__nr">{item.nr}</span> {item.title} ·{' '}
                  <MoneyAmount cents={item.priceCents} locale="de" />
                </li>
              ))}
            </ul>
            <dl className="pc-order__facts">
              <dt>{adminText('orderPayment')}</dt>
              <dd data-testid="withdrawal-payment">{order.paymentLabel}</dd>
              <dt>{adminText('orderTotal')}</dt>
              <dd>
                <MoneyAmount cents={order.totalCents} locale="de" />
              </dd>
              <dt>{adminText('withdrawalRegularDeadline')}</dt>
              <dd>
                {order.regularDeadline ?? adminText('withdrawalRegularDeadlineOpen')}
                {order.regularDeadlineEstimated ? (
                  <>
                    {' '}
                    <StatusBadge tone="info">{adminText('shippedEstimated')}</StatusBadge>
                  </>
                ) : null}
              </dd>
            </dl>
          </>
        ) : (
          <p data-testid="withdrawal-unmatched">
            <StatusBadge tone="warning">{adminText('withdrawalUnmatched')}</StatusBadge>{' '}
            {card.matchLabel}
          </p>
        )}
      </section>

      <section className="pc-order__section" aria-labelledby="withdrawal-actions">
        <h2 id="withdrawal-actions">{adminText('withdrawalActions')}</h2>
        {detail.returnProofText ? (
          <p data-testid="withdrawal-proof-done">
            {adminText('withdrawalProofDone', { date: detail.returnProofText })}
          </p>
        ) : null}
        {detail.returnConditionNote ? (
          <p data-testid="withdrawal-return-note">
            {adminText('withdrawalReturnNote')}: {detail.returnConditionNote}
          </p>
        ) : null}
        <WithdrawalActions
          id={card.id}
          reference={card.reference}
          status={card.status}
          orderId={order?.id ?? null}
          returnProofReceivedAt={detail.returnProofReceivedAt}
          items={(order?.items ?? []).map((i) => ({
            productId: i.productId,
            nr: i.nr,
            status: i.status,
          }))}
          refund={
            refund ? (
              <RefundDialog
                orderId={refund.orderId}
                orderNumber={refund.orderNumber}
                prepayment={refund.prepayment}
                items={refund.items}
                proposal={refund.proposal}
                pending={refund.pending}
                refundable={refund.refundable}
                withdrawalId={card.id}
              />
            ) : undefined
          }
          closeReasons={WITHDRAWAL_CLOSE_REASONS.filter((r) => r !== 'unpaid_order_cancelled').map(
            (r) => ({ value: r, label: ENUM_LABELS.WITHDRAWAL_CLOSE_REASONS[r].de }),
          )}
        />
      </section>

      <section className="pc-order__section" aria-labelledby="withdrawal-notes">
        <h2 id="withdrawal-notes">{adminText('notesTitle')}</h2>
        <NotesEditor
          url={`/api/withdrawals/${card.id}/notes`}
          initial={detail.adminNotes}
          maxLength={WITHDRAWAL_NOTES_MAX}
        />
      </section>
    </div>
  )
}
