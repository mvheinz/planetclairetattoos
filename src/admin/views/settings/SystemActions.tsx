'use client'

import { useRouter } from 'next/navigation'
import React, { useRef } from 'react'

import { ActionButton } from '../../components/ActionButton'
import { newIdempotencyKey, postAdminAction } from '../../components/adminAction'
import { adminText } from '../../translations'

// Knöpfe der Ansicht Einstellungen → System (PLAN P5.22, ARCHITEKTUR §11.5): „Jetzt ausführen“ je Task
// (`POST /api/cron/run/[task]` mit Admin-Sitzung, Bestätigungsdialog) und „Erneut senden“ für fehlgeschlagene
// Kund:innen-Mails einer Bestellung (`POST /api/orders/:id/resend-email`, wie im Bestell-Detail P5.9).

export function RunTaskButton({ task, label }: { task: string; label: string }) {
  const router = useRouter()
  return (
    <ActionButton
      variant="secondary"
      data-testid={`system-run-${task}`}
      confirm={{
        title: adminText('systemRunDialog', { label }),
        consequence: adminText('systemRunConsequence'),
      }}
      action={async () => {
        const res = await postAdminAction<{ ran?: number }>(
          `/api/cron/run/${encodeURIComponent(task)}`,
        )
        return { ...res, message: adminText('systemRunDone', { ran: res.ran ?? 0 }) }
      }}
      onDone={() => router.refresh()}
    >
      {adminText('systemRunNow')}
      <span className="pc-visually-hidden"> {label}</span>
    </ActionButton>
  )
}

export function ResendFailedMailButton({
  orderId,
  template,
  label,
}: {
  orderId: number
  template: string
  label: string
}) {
  const router = useRouter()
  const dialogKey = useRef(newIdempotencyKey())
  return (
    <ActionButton
      variant="secondary"
      effects={['mail']}
      data-testid={`system-resend-${orderId}-${template}`}
      confirm={{
        title: adminText('orderResendDialog', { label }),
        consequence: adminText('orderResendConsequence'),
      }}
      action={async () => {
        const res = await postAdminAction(`/api/orders/${orderId}/resend-email`, {
          template,
          dialogKey: dialogKey.current,
        })
        return { ...res, message: res.unchanged ? undefined : adminText('orderResendDone') }
      }}
      onDone={() => {
        dialogKey.current = newIdempotencyKey()
        router.refresh()
      }}
    >
      {adminText('systemResend')}
      <span className="pc-visually-hidden"> {label}</span>
    </ActionButton>
  )
}
