import React from 'react'

import { ENUM_LABELS } from '@/lib/enumLabels'
import { EMAIL_STATUSES, EMAIL_TEMPLATES } from '@/lib/enums'
import { listProtocols, parseProtocolFilters } from '@/lib/privacy/logs'

import { adminText } from '../../translations'
import type { AdminViewBodyProps } from '../AdminViewBody'
import { adminView } from '../registry'
import { ConsentLogTable, EmailLogTable } from './LogTables'

// Gesamtliste „Mail- und Einwilligungs-Protokolle“ `/export/protokolle` (PLAN P6.19, KONZEPT §6.1, §7.15): Filter Art
// (Mails/Einwilligungen), Zeitraum (von–bis, Berliner Tage), Status und Mail-Typ als einfaches GET-Formular (geht ohne
// JavaScript). Höchstens 200 Zeilen, neueste zuerst; Empfänger maskiert, keine Inhalte.

export async function ProtocolsView({ adminRoute, req, searchParams }: AdminViewBodyProps) {
  const f = parseProtocolFilters(searchParams)
  const { emails, consents } = await listProtocols(req, f)
  const action = `${adminRoute}${adminView('protokolle').path}`
  return (
    <div className="pc-order" data-testid="protocols">
      <p className="pc-order__muted">{adminText('logsIntro')}</p>
      <form
        method="get"
        action={action}
        className="pc-order__section"
        data-testid="protocols-filter"
      >
        <div className="pc-field">
          <label htmlFor="logs-art" className="pc-field__label">
            {adminText('logsKind')}
          </label>
          <select
            id="logs-art"
            name="art"
            defaultValue={f.kind === 'consent' ? 'einwilligungen' : 'mails'}
          >
            <option value="mails">{adminText('logsKindMails')}</option>
            <option value="einwilligungen">{adminText('logsKindConsents')}</option>
          </select>
        </div>
        <div className="pc-field">
          <label htmlFor="logs-von" className="pc-field__label">
            {adminText('logsFrom')}
          </label>
          <input id="logs-von" type="date" name="von" defaultValue={f.from ?? ''} />
        </div>
        <div className="pc-field">
          <label htmlFor="logs-bis" className="pc-field__label">
            {adminText('logsTo')}
          </label>
          <input id="logs-bis" type="date" name="bis" defaultValue={f.to ?? ''} />
        </div>
        <div className="pc-field">
          <label htmlFor="logs-status" className="pc-field__label">
            {adminText('logsColStatus')}
          </label>
          <select id="logs-status" name="status" defaultValue={f.status ?? ''}>
            <option value="">{adminText('logsAll')}</option>
            {f.kind === 'consent' ? (
              <>
                <option value="granted">{adminText('logsConsentActive')}</option>
                <option value="withdrawn">{adminText('logsConsentWithdrawn')}</option>
              </>
            ) : (
              EMAIL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ENUM_LABELS.EMAIL_STATUSES[s].de}
                </option>
              ))
            )}
          </select>
        </div>
        {f.kind === 'email' ? (
          <div className="pc-field">
            <label htmlFor="logs-typ" className="pc-field__label">
              {adminText('logsColType')}
            </label>
            <select id="logs-typ" name="typ" defaultValue={f.template ?? ''}>
              <option value="">{adminText('logsAll')}</option>
              {EMAIL_TEMPLATES.map((t) => (
                <option key={t} value={t}>
                  {ENUM_LABELS.EMAIL_TEMPLATES[t].de}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <p className="pc-admin-row">
          <button
            type="submit"
            className="pc-admin-btn pc-admin-btn--primary"
            data-testid="protocols-apply"
          >
            {adminText('logsApply')}
          </button>
        </p>
      </form>
      <section className="pc-order__section" aria-labelledby="protocols-result">
        <h2 id="protocols-result">
          {f.kind === 'consent' ? adminText('logsKindConsents') : adminText('logsKindMails')}
        </h2>
        <p role="status" className="pc-order__count" data-testid="protocols-count">
          {adminText('logsCount', {
            count: f.kind === 'consent' ? consents.length : emails.length,
          })}
        </p>
        {f.kind === 'consent' ? (
          <ConsentLogTable
            rows={consents}
            adminRoute={adminRoute}
            caption={adminText('logsKindConsents')}
            links
          />
        ) : (
          <EmailLogTable
            rows={emails}
            adminRoute={adminRoute}
            caption={adminText('logsKindMails')}
            links
          />
        )}
      </section>
    </div>
  )
}
