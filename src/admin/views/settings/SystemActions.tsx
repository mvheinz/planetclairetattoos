'use client'

import { useRouter } from 'next/navigation'
import React, { useRef, useState } from 'react'

import { ActionButton } from '../../components/ActionButton'
import { newIdempotencyKey, postAdminAction } from '../../components/adminAction'
import { Notice } from '../../components/Notice'
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

export function PostRestoreForm() {
  const router = useRouter()
  const [when, setWhen] = useState('')
  return (
    <div className="pc-admin-action" data-testid="system-post-restore">
      <label>
        {adminText('systemPostRestoreWhen')}{' '}
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          data-testid="system-post-restore-when"
        />
      </label>
      <ActionButton
        variant="secondary"
        disabled={!when}
        data-testid="system-post-restore-run"
        confirm={{
          title: adminText('systemPostRestoreDialog'),
          consequence: adminText('systemPostRestoreConsequence'),
        }}
        action={async () => {
          const res = await postAdminAction<{
            report?: {
              replay: { reapplied: number }
              payments: { events: number }
              invoices: { missing: string[] }
            }
          }>('/api/admin/post-restore', {
            backupCreatedAt: new Date(when).toISOString(),
            confirm: 'ABGLEICHEN',
          })
          return {
            ...res,
            message: adminText('systemPostRestoreDone', {
              reapplied: res.report?.replay.reapplied ?? 0,
              events: res.report?.payments.events ?? 0,
              missing: res.report?.invoices.missing.length ?? 0,
            }),
          }
        }}
        onDone={() => router.refresh()}
      >
        {adminText('systemPostRestoreRun')}
      </ActionButton>
    </div>
  )
}

export function ResendFailedMailButton({
  orderId,
  template,
  label,
  onSent,
}: {
  orderId: number
  template: string
  label: string
  onSent?: () => void
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
      onDone={(outcome) => {
        dialogKey.current = newIdempotencyKey()
        if (!outcome.unchanged) onSent?.()
        router.refresh()
      }}
    >
      {adminText('systemResend')}
      <span className="pc-visually-hidden"> {label}</span>
    </ActionButton>
  )
}

/**
 * Aktionsspalte einer fehlgeschlagenen Mail. Nach „Erneut senden“ lädt `router.refresh()` die Liste neu; die Zeile
 * zeigt dann „erneut gesendet am …“ statt des Knopfes. Damit die Rückmeldung „Die Mail ist unterwegs.“ dabei nicht
 * mit dem Knopf verschwindet, hält diese Komponente (gleicher Platz im Baum, Zustand bleibt erhalten) sie selbst.
 */
export function FailedMailAction({
  orderId,
  template,
  label,
  resentText,
  resentTestId,
  notHereText,
}: {
  orderId?: number | null
  template: string
  label: string
  resentText?: string
  resentTestId: string
  notHereText?: string
}) {
  const [sent, setSent] = useState(false)
  if (resentText) {
    return (
      <span className="pc-admin-action">
        <span className="pc-order__muted" data-testid={resentTestId}>
          {resentText}
        </span>
        {sent ? <Notice tone="success">{adminText('orderResendDone')}</Notice> : null}
      </span>
    )
  }
  if (orderId && !notHereText) {
    return (
      <ResendFailedMailButton
        orderId={orderId}
        template={template}
        label={label}
        onSent={() => setSent(true)}
      />
    )
  }
  return <span className="pc-order__muted">{notHereText}</span>
}
