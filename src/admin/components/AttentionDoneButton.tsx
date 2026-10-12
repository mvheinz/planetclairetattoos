'use client'

import { useRouter } from 'next/navigation'
import React from 'react'

import { adminText } from '../translations'
import { ActionButton } from './ActionButton'
import { postAdminAction } from './adminAction'

// „Erledigt“ (V-31, P20.6): löscht eine Markierung „von Hand“ (z. B. „Bitte prüfen“ aus dem Bestands-Import) direkt am
// Stück bzw. an der Bestellung. Nur eine Notiz für dich – ohne Wirkung nach außen, daher ohne Rückfrage. Danach lädt
// die Ansicht neu (bzw. `onDone`).

export function AttentionDoneButton({
  url,
  onDone,
  'data-testid': testId = 'attention-done',
}: {
  /** z. B. `/api/products/17/attention-done` oder `/api/orders/5/attention-done`. */
  url: string
  onDone?: () => void
  'data-testid'?: string
}) {
  const router = useRouter()
  return (
    <ActionButton
      variant="secondary"
      data-testid={testId}
      action={async () => {
        const r = await postAdminAction(url)
        return { unchanged: r.unchanged, message: adminText('piecesAttentionDoneMessage') }
      }}
      onDone={() => (onDone ? onDone() : router.refresh())}
    >
      {adminText('piecesAttentionDone')}
    </ActionButton>
  )
}
