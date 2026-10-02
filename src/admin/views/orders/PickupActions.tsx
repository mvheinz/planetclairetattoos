'use client'

import { useRouter } from 'next/navigation'
import React, { useId, useState } from 'react'

import { ActionButton } from '../../components/ActionButton'
import { postAdminAction } from '../../components/adminAction'
import { adminText } from '../../translations'

// Knöpfe einer Karte in „Abholung“ (PLAN P5.17): „Bereit zur Abholung“ mit Textfeld (vorbelegt aus
// `settings.pickup.instructions` und der Abholadresse, editierbar; gespeichert an der Bestellung) → O8 und Mail M07;
// „Abgeholt“ → O9. Die Adresse steht nur in dieser Mail (E-29).

export interface PickupActionsProps {
  orderId: number
  orderNumber: string
  status: string
  template: string | null
  messageText: string | null
}

export function PickupActions(props: PickupActionsProps) {
  const router = useRouter()
  const [text, setText] = useState(props.template ?? '')
  const fieldId = useId()
  const hintId = useId()

  if (props.status === 'paid') {
    return (
      <div className="pc-order__section" data-testid="pickup-actions">
        <div className="pc-field">
          <label htmlFor={fieldId} className="pc-field__label">
            {adminText('pickupText')}
          </label>
          <textarea
            id={fieldId}
            rows={6}
            maxLength={1500}
            value={text}
            aria-describedby={hintId}
            onChange={(e) => setText(e.target.value)}
            data-testid="pickup-text"
          />
          <p id={hintId} className="pc-order__muted">
            {adminText('pickupTextHint')}
          </p>
        </div>
        <p className="pc-admin-row">
          <ActionButton
            data-testid="mark-ready"
            disabled={text.trim() === ''}
            effects={['mail']}
            confirm={{
              title: adminText('pickupReadyTitle', { order: props.orderNumber }),
              consequence: adminText('pickupReadyConsequence'),
            }}
            action={() =>
              postAdminAction(`/api/orders/${props.orderId}/pickup-ready`, { messageText: text })
            }
            onDone={() => router.refresh()}
          >
            {adminText('pickupReady')}
          </ActionButton>
        </p>
      </div>
    )
  }
  return (
    <div className="pc-order__section" data-testid="pickup-actions">
      {props.messageText ? (
        <details>
          <summary>{adminText('pickupSentText')}</summary>
          <p style={{ whiteSpace: 'pre-line' }}>{props.messageText}</p>
        </details>
      ) : null}
      <p className="pc-admin-row">
        <ActionButton
          data-testid="mark-picked-up"
          confirm={{
            title: adminText('pickupDoneTitle', { order: props.orderNumber }),
            consequence: adminText('pickupDoneConsequence'),
          }}
          action={() => postAdminAction(`/api/orders/${props.orderId}/picked-up`)}
          onDone={() => router.refresh()}
        >
          {adminText('pickupDone')}
        </ActionButton>
      </p>
    </div>
  )
}
