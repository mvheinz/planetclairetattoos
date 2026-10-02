'use client'

import { useRouter } from 'next/navigation'
import React from 'react'

import { ActionButton } from '../../components/ActionButton'
import { postAdminAction } from '../../components/adminAction'
import { tattooText } from './tattooText'

// Knöpfe einer Flash-Karte (PLAN P7.6): Status-Chip „verfügbar“/„vergeben“ – antippen, bestätigen (2 Taps) – und
// „Offline nehmen“/„Online stellen“. Ein wiederholbares Motiv lehnt der Server mit Hinweis auf „Offline nehmen“ ab.

export function FlashCardActions({
  id,
  nr,
  status,
  published,
}: {
  id: number
  nr: string
  status: 'available' | 'claimed'
  published: boolean
}) {
  const router = useRouter()
  const next = status === 'available' ? 'claimed' : 'available'
  const refresh = () => router.refresh()
  return (
    <div className="pc-admin-row pc-pieces__actions">
      <ActionButton
        variant="secondary"
        data-testid="flash-status-chip"
        action={() => postAdminAction(`/api/flash/${id}/status`, { status: next })}
        onDone={refresh}
        confirm={{
          title: tattooText(next === 'claimed' ? 'flashClaimTitle' : 'flashReleaseTitle', { nr }),
          consequence: tattooText(next === 'claimed' ? 'flashClaimText' : 'flashReleaseText'),
          confirmLabel: tattooText(
            next === 'claimed' ? 'flashClaimConfirm' : 'flashReleaseConfirm',
          ),
        }}
      >
        <span className={`pc-chip pc-chip--${status}`} aria-hidden="true" />
        {tattooText(status === 'available' ? 'statusAvailable' : 'statusClaimed')}
        <span className="pc-visually-hidden"> {tattooText('flashChipHint', { nr })}</span>
      </ActionButton>
      <ActionButton
        variant="secondary"
        data-testid="flash-published"
        action={() => postAdminAction(`/api/flash/${id}/published`, { published: !published })}
        onDone={refresh}
      >
        {tattooText(published ? 'takeOffline' : 'putOnline')}
        <span className="pc-visually-hidden"> {nr}</span>
      </ActionButton>
    </div>
  )
}
