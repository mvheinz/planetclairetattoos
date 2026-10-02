'use client'

import { useRouter } from 'next/navigation'
import React from 'react'

import { ActionButton } from '../../components/ActionButton'
import { postAdminAction } from '../../components/adminAction'
import { adminText } from '../../translations'

// „Kopie an mich“ (PLAN P6.19, KONZEPT §6.1): M08 noch einmal – nur an die Verwaltungs-Adresse, nie an die Kundin.

export function ReceiptCopyButton({ id }: { id: number }) {
  const router = useRouter()
  return (
    <ActionButton
      variant="secondary"
      effects={['mail']}
      data-testid="withdrawal-receipt-copy"
      confirm={{
        title: adminText('logsReceiptCopyTitle'),
        consequence: adminText('logsReceiptCopyConsequence'),
      }}
      action={async () => {
        await postAdminAction(`/api/withdrawals/${id}/receipt-copy`)
        return { message: adminText('logsReceiptCopyDone') }
      }}
      onDone={() => router.refresh()}
    >
      {adminText('logsReceiptCopy')}
    </ActionButton>
  )
}
