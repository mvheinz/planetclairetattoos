import React from 'react'

import { ENUM_LABELS } from '@/lib/enumLabels'
import { loadLegalSnippetsOverview, loadLegalTextsOverview } from '@/lib/legal/admin'
import { requestNow } from '@/lib/payload/context'
import { formatBerlin } from '@/lib/time'

import { StatusBadge } from '../../components/StatusBadge'
import { adminText } from '../../translations'
import type { AdminViewBodyProps } from '../AdminViewBody'
import { LegalReviewButton, LegalVersionEditor } from './LegalVersionEditor'

// Bereich „Rechtstexte“ der Ansicht „Texte“ (PLAN P6.4, KONZEPT §7.13): je Typ die aktive Fassung mit „Stand“,
// Herkunft, Alter, Anzahl Bestellungen und letzter Prüfung, frühere und geplante Fassungen, „Neue Version“ und
// „Geprüft, keine Änderung“; darunter die Rechtsbausteine (Liste nach Schlüssel, Spalte „Kanzlei ja/nein“). Alte
// Fassungen öffnen nur lesend in „Alle Daten“ (KONZEPT §7.16).

const API = '/api'
const date = (iso: string | null | undefined) =>
  iso ? formatBerlin(new Date(iso), 'dd.MM.yyyy') : '–'
const originLabel = (o: keyof typeof ENUM_LABELS.LEGAL_TEXT_ORIGINS) =>
  ENUM_LABELS.LEGAL_TEXT_ORIGINS[o].de
const statusLabel = (s: keyof typeof ENUM_LABELS.LEGAL_TEXT_STATUSES) =>
  ENUM_LABELS.LEGAL_TEXT_STATUSES[s].de

export async function LegalTextsArea({ adminRoute, req }: AdminViewBodyProps) {
  const now = requestNow(req)
  const [texts, snippets] = await Promise.all([
    loadLegalTextsOverview(req, now),
    loadLegalSnippetsOverview(req),
  ])
  const docHref = (collection: string, id: number) =>
    `${adminRoute}/collections/${collection}/${id}`

  return (
    <>
      <p className="pc-order__muted">{adminText('legalHint')}</p>
      <ul className="pc-order__list" data-testid="legal-texts">
        {texts.map((row) => {
          const label = ENUM_LABELS.LEGAL_TEXT_TYPES[row.type].de
          const a = row.active
          return (
            <li
              key={row.type}
              className="pc-order__card"
              data-testid="legal-type"
              data-type={row.type}
            >
              <h3 className="pc-order__cardtitle">
                {label}{' '}
                {a ? (
                  <StatusBadge tone={a.origin === 'lawyer' ? 'success' : 'warning'}>
                    {originLabel(a.origin)}
                  </StatusBadge>
                ) : (
                  <StatusBadge tone="warning">{adminText('todayLegalMissing')}</StatusBadge>
                )}
                {row.reviewDue ? (
                  <StatusBadge tone="warning">{adminText('todayLegalWarnOverdue')}</StatusBadge>
                ) : null}
              </h3>
              {a ? (
                <dl className="pc-order__meta pc-legal__facts" data-testid="legal-active">
                  <div>
                    <dt>{adminText('legalVersion')}</dt>
                    <dd data-testid="legal-active-version">
                      <a href={docHref('legal-texts', a.id)} className="pc-admin-link">
                        v{a.version}
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt>{adminText('legalAsOf')}</dt>
                    <dd>{date(a.validFrom)}</dd>
                  </div>
                  <div>
                    <dt>{adminText('legalOrigin')}</dt>
                    <dd>{originLabel(a.origin)}</dd>
                  </div>
                  <div>
                    <dt>{adminText('todayLegalAge')}</dt>
                    <dd>{adminText('todayLegalAgeDays', { days: row.ageDays ?? 0 })}</dd>
                  </div>
                  <div>
                    <dt>{adminText('legalOrders')}</dt>
                    <dd data-testid="legal-active-orders">{a.orderCount}</dd>
                  </div>
                  <div>
                    <dt>{adminText('legalLastReview')}</dt>
                    <dd data-testid="legal-last-review">{date(row.lastReviewedAt)}</dd>
                  </div>
                </dl>
              ) : null}
              {row.versions.length ? (
                <details>
                  <summary>{adminText('legalOtherVersions', { n: row.versions.length })}</summary>
                  <div
                    className="pc-revenue__scroll"
                    tabIndex={0}
                    role="region"
                    aria-label={adminText('legalOtherVersions', { n: row.versions.length })}
                  >
                    <table className="pc-revenue__table">
                      <thead>
                        <tr>
                          <th scope="col">{adminText('legalVersion')}</th>
                          <th scope="col">{adminText('legalStatus')}</th>
                          <th scope="col">{adminText('legalAsOf')}</th>
                          <th scope="col">{adminText('legalOrigin')}</th>
                          <th scope="col">{adminText('legalOrders')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {row.versions.map((v) => (
                          <tr key={v.id} data-testid="legal-version-row" data-id={v.id}>
                            <th scope="row">
                              <a href={docHref('legal-texts', v.id)} className="pc-admin-link">
                                v{v.version}
                              </a>
                            </th>
                            <td>{statusLabel(v.status)}</td>
                            <td>{date(v.validFrom)}</td>
                            <td>{originLabel(v.origin)}</td>
                            <td data-testid="legal-version-orders">{v.orderCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              ) : null}
              {a ? <LegalReviewButton type={row.type} apiBase={API} /> : null}
              <LegalVersionEditor
                target={{ kind: 'text', type: row.type, label }}
                apiBase={API}
                data-testid="legal-editor"
              />
            </li>
          )
        })}
      </ul>

      <h3 id="texts-snippets">{adminText('legalSnippets')}</h3>
      <p className="pc-order__muted">{adminText('legalSnippetsHint')}</p>
      <LegalVersionEditor
        target={{
          kind: 'snippet',
          keys: snippets.map((s) => ({ key: s.key, label: s.key })),
        }}
        apiBase={API}
        data-testid="legal-snippet-editor"
      />
      <div
        className="pc-revenue__scroll"
        tabIndex={0}
        role="region"
        aria-labelledby="texts-snippets"
      >
        <table className="pc-revenue__table" data-testid="legal-snippets">
          <thead>
            <tr>
              <th scope="col">{adminText('legalSnippetKey')}</th>
              <th scope="col">{adminText('legalSnippetLawyer')}</th>
              <th scope="col">{adminText('legalVersion')}</th>
              <th scope="col">{adminText('legalAsOf')}</th>
              <th scope="col">{adminText('legalOrigin')}</th>
              <th scope="col">{adminText('legalSnippetOlder')}</th>
            </tr>
          </thead>
          <tbody>
            {snippets.map((s) => (
              <tr key={s.key} data-testid="legal-snippet-row" data-key={s.key}>
                <th scope="row">{s.key}</th>
                <td data-testid="legal-snippet-lawyer">
                  {s.requiresLawyer ? adminText('legalYes') : adminText('legalNo')}
                </td>
                <td>
                  {s.active ? (
                    <a href={docHref('legal-snippets', s.active.id)} className="pc-admin-link">
                      v{s.active.version}
                    </a>
                  ) : (
                    adminText('todayLegalMissing')
                  )}
                </td>
                <td>{date(s.active?.validFrom)}</td>
                <td>
                  {s.active ? (
                    <StatusBadge
                      tone={
                        s.active.origin === 'lawyer' || !s.requiresLawyer ? 'success' : 'warning'
                      }
                    >
                      {originLabel(s.active.origin)}
                    </StatusBadge>
                  ) : (
                    '–'
                  )}
                </td>
                <td>
                  {s.superseded}
                  {s.scheduled ? ` · ${adminText('legalScheduledN', { n: s.scheduled })}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
