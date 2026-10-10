'use client'

import { useRouter } from 'next/navigation'
import React from 'react'

import { ActionButton } from '../../components/ActionButton'
import { postAdminAction } from '../../components/adminAction'
import { StatusBadge } from '../../components/StatusBadge'
import { adminText, type AdminCustomKey } from '../../translations'
import { formatEuroInput } from '@/lib/money'
import { formatBerlin } from '@/lib/time'

// Zahlungen ohne Bestellung (U-58 a, J-26/J-27): zu spät (Kasse schon beendet) oder zusätzlich zur Vorkasse bezahlt.
// Knopf „Erstatten“ mit Bestätigung (Geld-Wirkung) → `POST /api/checkouts/:id/refund-stray-payment`; der Endpunkt ist
// idempotent (läuft/erstattet → „schon erledigt“). Auf „Heute“ alle offenen, an der Bestellung die zugehörigen.

export interface StrayPaymentItem {
  checkoutId: number
  orderId: number | null
  kind: 'late' | 'double'
  paymentIntentId: string
  amountCents: number | null
  receivedAt: string
  refundStatus: 'none' | 'pending' | 'succeeded' | 'failed'
}

const STATUS: Record<StrayPaymentItem['refundStatus'], AdminCustomKey> = {
  none: 'strayStatusNone',
  pending: 'strayStatusPending',
  succeeded: 'strayStatusSucceeded',
  failed: 'strayStatusFailed',
}

export function StrayPaymentsPanel({
  items,
  adminRoute,
  showOrderLink = true,
}: {
  items: readonly StrayPaymentItem[]
  adminRoute: string
  showOrderLink?: boolean
}) {
  const router = useRouter()
  if (items.length === 0) return null
  return (
    <section
      className="pc-order__section"
      aria-labelledby="stray-payments-title"
      data-testid="stray-payments"
    >
      <h2 id="stray-payments-title">{adminText('strayHeading')}</h2>
      <p className="pc-piece__hint">{adminText('strayHint')}</p>
      <ul className="pc-order__list">
        {items.map((p) => {
          const amount =
            p.amountCents === null
              ? adminText('strayAmountUnknown')
              : `${formatEuroInput(p.amountCents)} €`
          const open = p.refundStatus === 'none' || p.refundStatus === 'failed'
          return (
            <li
              key={p.paymentIntentId}
              className="pc-today__order"
              data-testid="stray-payment"
              data-status={p.refundStatus}
            >
              <span>
                {adminText(p.kind === 'double' ? 'strayKindDouble' : 'strayKindLate')} · {amount} ·{' '}
                {adminText('strayReceived', {
                  date: formatBerlin(new Date(p.receivedAt), 'dd.MM.yyyy HH:mm'),
                })}
              </span>
              <StatusBadge
                tone={
                  p.refundStatus === 'succeeded'
                    ? 'success'
                    : p.refundStatus === 'failed'
                      ? 'error'
                      : 'warning'
                }
              >
                {adminText(STATUS[p.refundStatus])}
              </StatusBadge>
              {showOrderLink && p.orderId !== null ? (
                <a className="pc-admin-link" href={`${adminRoute}/bestellungen/${p.orderId}`}>
                  {adminText('strayToOrder')}
                </a>
              ) : null}
              {open && p.amountCents !== null ? (
                <ActionButton
                  variant="danger"
                  data-testid="stray-refund"
                  effects={['money']}
                  confirm={{
                    title: adminText('strayRefundTitle', { amount }),
                    consequence: adminText('strayRefundConsequence', { amount }),
                    confirmLabel: adminText('strayRefund'),
                  }}
                  action={() =>
                    postAdminAction(`/api/checkouts/${p.checkoutId}/refund-stray-payment`, {
                      paymentIntentId: p.paymentIntentId,
                    })
                  }
                  onDone={() => router.refresh()}
                >
                  {adminText('strayRefund')}
                </ActionButton>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
