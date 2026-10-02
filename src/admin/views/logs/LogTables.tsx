import React from 'react'

import type { ConsentLogRow, EmailLogRow } from '@/lib/privacy/logs'

import { StatusBadge } from '../../components/StatusBadge'
import { adminText } from '../../translations'
import { adminViewPath } from '../registry'

// Protokoll-Tabellen der Verwaltung (PLAN P6.19, KONZEPT §6.1, R-081): Mails mit Typ, Betreff, Zeitpunkt, Anbieter-ID,
// Status und Anhang-Namen; Einwilligungen mit Zweck, Zeitpunkt, Baustein-Version und Widerruf. Empfänger maskiert, nie
// Mail-Inhalte oder Freitexte. Waagerecht scrollbar auf dem Handy (eigener, per Tastatur erreichbarer Bereich).

const STATUS_TONE: Record<string, 'success' | 'warning' | 'error' | 'neutral' | 'info'> = {
  sent: 'success',
  queued: 'info',
  failed: 'error',
  suppressed: 'neutral',
}

export function EmailLogTable({
  rows,
  adminRoute,
  caption,
  links = false,
  testId = 'email-log-table',
}: {
  rows: EmailLogRow[]
  adminRoute: string
  caption: string
  /** Spalte „Bezug“ mit Links (Gesamtliste). */
  links?: boolean
  testId?: string
}) {
  if (rows.length === 0) return <p data-testid={`${testId}-empty`}>{adminText('logsNoMails')}</p>
  return (
    <div className="pc-revenue__scroll" tabIndex={0} role="region" aria-label={caption}>
      <table className="pc-revenue__table" data-testid={testId}>
        <caption className="pc-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{adminText('logsColType')}</th>
            <th scope="col">{adminText('logsColSubject')}</th>
            <th scope="col">{adminText('logsColAt')}</th>
            <th scope="col">{adminText('logsColTo')}</th>
            <th scope="col">{adminText('logsColStatus')}</th>
            <th scope="col">{adminText('logsColMessageId')}</th>
            <th scope="col">{adminText('logsColAttachments')}</th>
            {links ? <th scope="col">{adminText('logsColRelation')}</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr
              key={m.id}
              data-testid="email-log-row"
              data-template={m.template}
              data-status={m.status}
            >
              <th scope="row">
                {m.konzeptId} · {m.label}
              </th>
              <td>{m.subject}</td>
              <td>{m.at}</td>
              <td data-testid="email-log-to">{m.to}</td>
              <td>
                <StatusBadge tone={STATUS_TONE[m.status] ?? 'neutral'}>{m.statusLabel}</StatusBadge>
              </td>
              <td className="pc-order__mono">{m.messageId ?? '–'}</td>
              <td>{m.attachments.length ? m.attachments.join(', ') : '–'}</td>
              {links ? (
                <td>
                  {m.orderId ? (
                    <a
                      href={`${adminRoute}${adminViewPath('bestellung', m.orderId)}`}
                      className="pc-admin-link"
                    >
                      {adminText('logsOrder')}
                    </a>
                  ) : m.withdrawalId ? (
                    <a
                      href={`${adminRoute}${adminViewPath('widerruf', m.withdrawalId)}`}
                      className="pc-admin-link"
                    >
                      {adminText('logsWithdrawal')}
                    </a>
                  ) : m.inquiryId ? (
                    <a
                      href={`${adminRoute}${adminViewPath('anfrage', m.inquiryId)}`}
                      className="pc-admin-link"
                    >
                      {adminText('logsInquiry')}
                    </a>
                  ) : (
                    '–'
                  )}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ConsentLogTable({
  rows,
  adminRoute,
  caption,
  links = false,
  testId = 'consent-log-table',
}: {
  rows: ConsentLogRow[]
  adminRoute: string
  caption: string
  links?: boolean
  testId?: string
}) {
  if (rows.length === 0) return <p data-testid={`${testId}-empty`}>{adminText('logsNoConsents')}</p>
  return (
    <div className="pc-revenue__scroll" tabIndex={0} role="region" aria-label={caption}>
      <table className="pc-revenue__table" data-testid={testId}>
        <caption className="pc-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{adminText('logsColPurpose')}</th>
            <th scope="col">{adminText('logsColAt')}</th>
            <th scope="col">{adminText('logsColGranted')}</th>
            <th scope="col">{adminText('logsColSnippet')}</th>
            <th scope="col">{adminText('logsColWithdrawn')}</th>
            <th scope="col">{adminText('logsColTo')}</th>
            {links ? <th scope="col">{adminText('logsColRelation')}</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} data-testid="consent-log-row" data-purpose={c.purpose}>
              <th scope="row">{c.purposeLabel}</th>
              <td>{c.at}</td>
              <td>{c.granted ? adminText('logsYes') : adminText('logsNo')}</td>
              <td>{c.snippet}</td>
              <td>{c.withdrawnAt ?? '–'}</td>
              <td>{c.email}</td>
              {links ? (
                <td>
                  {c.orderId ? (
                    <a
                      href={`${adminRoute}${adminViewPath('bestellung', c.orderId)}`}
                      className="pc-admin-link"
                    >
                      {adminText('logsOrder')}
                    </a>
                  ) : (
                    '–'
                  )}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
