'use client'

import { useRouter } from 'next/navigation'
import React from 'react'

import { ActionButton } from '../../components/ActionButton'
import { postAdminAction } from '../../components/adminAction'
import { adminText } from '../../translations'

// „Gepackt“ auf der Karte in „Zu packen“ (PLAN P5.10, O6): speichert die Verpackung mit der Standard-Vorlage der
// Versandklasse (änderbar im Bestell-Detail). Doppeltipp → ein Statuswechsel (Knopf-Sperre und Endpunkt idempotent).

export function PackedButton({ orderId }: { orderId: number }) {
  const router = useRouter()
  return (
    <ActionButton
      data-testid="mark-packed"
      action={() => postAdminAction(`/api/orders/${orderId}/packed`)}
      onDone={() => router.refresh()}
    >
      {adminText('packingPacked')}
    </ActionButton>
  )
}
