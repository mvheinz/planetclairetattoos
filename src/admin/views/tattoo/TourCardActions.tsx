'use client'

import { useRouter } from 'next/navigation'
import React from 'react'

import { ActionButton } from '../../components/ActionButton'
import { adminText } from '../../translations'
import { requestJson } from './tattooForm'
import { tattooText } from './tattooText'

// Knöpfe einer Termin-Karte (P12.8): „Absagen“ / „Wieder geplant“ (mit Rückfrage, die Folge nennt) und „Offline nehmen“ /
// „Online stellen“. Gespeichert über die REST-API von `tour-dates` (der Hook normalisiert den Zeitraum und erneuert die
// Startseite).

async function patch(id: number, data: Record<string, unknown>): Promise<void> {
  const res = await requestJson(`/api/tour-dates/${id}?locale=de&depth=0`, {
    method: 'PATCH',
    json: data,
  })
  if (!res.ok) {
    const first = (res.json.errors as { message?: string }[] | undefined)?.[0]?.message
    throw new Error(
      String(res.json.error ?? first ?? adminText('actionFailed', { message: String(res.status) })),
    )
  }
}

export function TourCardActions({
  id,
  name,
  status,
  published,
  over,
}: {
  id: number
  name: string
  status: 'planned' | 'cancelled' | 'past'
  published: boolean
  /** Vergangen: Absagen ergibt dann keinen Sinn. */
  over: boolean
}) {
  const router = useRouter()
  const refresh = () => router.refresh()
  const cancelled = status === 'cancelled'
  return (
    <div className="pc-admin-row pc-pieces__actions">
      {over && !cancelled ? null : (
        <ActionButton
          variant="secondary"
          data-testid="tour-status"
          action={() => patch(id, { status: cancelled ? 'planned' : 'cancelled' })}
          onDone={refresh}
          confirm={{
            title: tattooText(cancelled ? 'tourRestoreTitle' : 'tourCancelTitle', { name }),
            consequence: tattooText(cancelled ? 'tourRestoreText' : 'tourCancelText'),
            confirmLabel: tattooText(cancelled ? 'tourRestoreConfirm' : 'tourCancelConfirm'),
          }}
        >
          {tattooText(cancelled ? 'tourRestore' : 'tourCancel')}
          <span className="pc-visually-hidden"> {name}</span>
        </ActionButton>
      )}
      <ActionButton
        variant="secondary"
        data-testid="tour-published"
        action={() => patch(id, { published: !published })}
        onDone={refresh}
      >
        {tattooText(published ? 'takeOffline' : 'putOnline')}
        <span className="pc-visually-hidden"> {name}</span>
      </ActionButton>
    </div>
  )
}
