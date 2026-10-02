'use client'

import { useRouter } from 'next/navigation'
import React, { useRef } from 'react'

import { ActionButton } from '../../components/ActionButton'
import { newIdempotencyKey, postAdminAction } from '../../components/adminAction'
import { adminText } from '../../translations'

// „Erneut senden“ im Bestell-Detail (PLAN P5.9, KONZEPT §6.1): je Mail ein Knopf mit Bestätigungsdialog. Jeder
// Dialog hat einen eigenen Schlüssel (`dialogKey`, neu nach jeder erfolgreichen Sendung) – ein zweiter Tipp im selben
// Dialog erzeugt serverseitig keine zweite Mail.

export interface ResendOptionView {
  template: string
  label: string
  available: boolean
}

function ResendButton({ orderId, option }: { orderId: number; option: ResendOptionView }) {
  const router = useRouter()
  const dialogKey = useRef(newIdempotencyKey())
  return (
    <ActionButton
      variant="secondary"
      effects={['mail']}
      data-testid={`resend-${option.template}`}
      confirm={{
        title: adminText('orderResendDialog', { label: option.label }),
        consequence: adminText('orderResendConsequence'),
      }}
      action={async () => {
        const res = await postAdminAction(`/api/orders/${orderId}/resend-email`, {
          template: option.template,
          dialogKey: dialogKey.current,
        })
        return { ...res, message: res.unchanged ? undefined : adminText('orderResendDone') }
      }}
      onDone={() => {
        dialogKey.current = newIdempotencyKey()
        router.refresh()
      }}
    >
      {adminText('orderResend', { label: option.label })}
    </ActionButton>
  )
}

export function OrderResend({
  orderId,
  options,
}: {
  orderId: number
  options: ResendOptionView[]
}) {
  return (
    <ul className="pc-order__resend" data-testid="order-resend">
      {options.map((option) => (
        <li key={option.template}>
          {option.available ? (
            <ResendButton orderId={orderId} option={option} />
          ) : (
            <span className="pc-order__muted">
              {option.label}: {adminText('orderResendNotYet')}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
