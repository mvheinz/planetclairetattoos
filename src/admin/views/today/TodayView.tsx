import React from 'react'

import { getTodaySummary, type TodayHint, type TodaySummary } from '@/lib/admin/today'
import { ENUM_LABELS } from '@/lib/enumLabels'
import type { LegalReviewWarning } from '@/lib/legal/review'
import { formatEuroInput } from '@/lib/money'
import { formatBerlin } from '@/lib/time'

import { AdminIcon } from '../../components/AdminIcon'
import { StatusBadge } from '../../components/StatusBadge'
import { adminText, type AdminCustomKey } from '../../translations'
import type { AdminViewBodyProps } from '../AdminViewBody'
import { adminView, adminViewPath, type AdminViewKey } from '../registry'

// Start-Ansicht „Heute“ `/heute` und `ADMIN_ROUTE` (PLAN P5.28, KONZEPT §7.3): Kacheln mit Zahl und Link, rote und
// gelbe Hinweise mit Link, Startklar-Prüfung (Platzhalter bis P10), letzte 5 Bestellungen, Schnellknopf „Neues Stück“.
// Daten aus `getTodaySummary(now)` (src/lib/admin/today.ts).

const TILES: readonly {
  key: keyof TodaySummary['tiles'] & AdminViewKey
  label: AdminCustomKey
}[] = [
  { key: 'packen', label: 'todayTilePacking' },
  { key: 'vorkasse', label: 'todayTilePrepayment' },
  { key: 'abholung', label: 'todayTilePickup' },
  { key: 'widerrufe', label: 'todayTileWithdrawals' },
  { key: 'anfragen', label: 'todayTileInquiries' },
]

function tileDetail(key: (typeof TILES)[number]['key'], s: TodaySummary): string | null {
  if (key === 'vorkasse' && s.tiles.vorkasse.count > 0) {
    return adminText('todayDueToday', { n: s.tiles.vorkasse.dueToday })
  }
  if (key === 'widerrufe' && s.tiles.widerrufe.nextDueAt) {
    return adminText('todayNextDeadline', {
      date: formatBerlin(new Date(s.tiles.widerrufe.nextDueAt), 'dd.MM.yyyy'),
      reference: s.tiles.widerrufe.nextReference ?? '',
    })
  }
  return null
}

const TONE_LABEL: Record<TodayHint['tone'], AdminCustomKey> = {
  error: 'todayToneError',
  warning: 'todayToneWarning',
  info: 'todayToneInfo',
}

const LEGAL_WARNING_LABEL: Record<LegalReviewWarning, AdminCustomKey> = {
  missing: 'todayLegalWarnMissing',
  not_lawyer: 'todayLegalWarnNotLawyer',
  overdue: 'todayLegalWarnOverdue',
}

/** Kachel „Rechtstexte“ (PLAN P6.20, R-014): je Typ Version, gültig ab, Herkunft, Alter; Warnungen gelb. */
function LegalTextsTile({ rows, href }: { rows: TodaySummary['legalTexts']; href: string }) {
  return (
    <section
      className="pc-order__section"
      aria-labelledby="today-legal-title"
      data-testid="today-legal"
    >
      <h2 id="today-legal-title">
        <a href={href} className="pc-admin-link">
          {adminText('todayLegalTitle')}
        </a>
      </h2>
      <div
        className="pc-revenue__scroll"
        tabIndex={0}
        role="region"
        aria-labelledby="today-legal-title"
      >
        <table className="pc-revenue__table">
          <thead>
            <tr>
              <th scope="col">{adminText('todayLegalType')}</th>
              <th scope="col">{adminText('todayLegalVersion')}</th>
              <th scope="col">{adminText('todayLegalValidFrom')}</th>
              <th scope="col">{adminText('todayLegalOrigin')}</th>
              <th scope="col">{adminText('todayLegalAge')}</th>
              <th scope="col">
                <span className="pc-visually-hidden">{adminText('todayToneWarning')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.type}
                data-testid="today-legal-row"
                data-type={r.type}
                data-warnings={r.warnings.join(' ')}
              >
                <th scope="row">{ENUM_LABELS.LEGAL_TEXT_TYPES[r.type].de}</th>
                <td>{r.present ? (r.version ?? '–') : adminText('todayLegalMissing')}</td>
                <td>{r.validFrom ? formatBerlin(new Date(r.validFrom), 'dd.MM.yyyy') : '–'}</td>
                <td>{r.origin ? ENUM_LABELS.LEGAL_TEXT_ORIGINS[r.origin].de : '–'}</td>
                <td>
                  {r.ageDays === null ? '–' : adminText('todayLegalAgeDays', { days: r.ageDays })}
                </td>
                <td>
                  {r.warnings.length === 0 ? (
                    <StatusBadge tone="success">{adminText('todayLegalOk')}</StatusBadge>
                  ) : (
                    r.warnings.map((w) => (
                      <StatusBadge key={w} tone="warning">
                        {adminText(LEGAL_WARNING_LABEL[w])}
                      </StatusBadge>
                    ))
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export async function TodayView({ adminRoute, req }: AdminViewBodyProps) {
  const summary = await getTodaySummary(new Date(), req.payload)
  const href = (path: string) => `${adminRoute}${path}`

  return (
    <div className="pc-order pc-today" data-testid="today">
      <p className="pc-admin-row">
        <a
          href={href(adminViewPath('neues-stueck'))}
          className="pc-admin-btn pc-admin-btn--primary"
          data-testid="today-new-piece"
        >
          {adminText('shellNewPiece')}
        </a>
      </p>

      <section aria-labelledby="today-tiles-title">
        <h2 id="today-tiles-title" className="pc-visually-hidden">
          {adminText('todayTiles')}
        </h2>
        <ul className="pc-today__tiles">
          {TILES.map(({ key, label }) => {
            const tile = summary.tiles[key]
            const detail = tileDetail(key, summary)
            return (
              <li key={key}>
                <a
                  href={href(adminViewPath(key))}
                  className="pc-today__tile"
                  data-testid={`today-tile-${key}`}
                  data-count={tile.count}
                >
                  <span className="pc-today__tileicon" aria-hidden="true">
                    <AdminIcon name={adminView(key).icon} />
                  </span>
                  <span className="pc-today__count">{tile.count}</span>
                  <span className="pc-today__label">{adminText(label)}</span>
                  {detail ? (
                    <span className="pc-today__detail" data-testid={`today-tile-${key}-detail`}>
                      {detail}
                    </span>
                  ) : null}
                </a>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="pc-order__section" aria-labelledby="today-hints-title">
        <h2 id="today-hints-title">{adminText('todayHints')}</h2>
        {summary.hints.length === 0 ? (
          <p data-testid="today-hints-none">{adminText('todayHintsNone')}</p>
        ) : (
          <ul className="pc-today__hints" data-testid="today-hints">
            {summary.hints.map((h) => (
              <li
                key={h.id}
                className={`pc-today__hint pc-today__hint--${h.tone}`}
                data-testid="today-hint"
                data-hint={h.id}
                data-tone={h.tone}
              >
                <StatusBadge tone={h.tone}>{adminText(TONE_LABEL[h.tone])}</StatusBadge>{' '}
                <span>{h.text}</span>{' '}
                <a href={href(h.href)} className="pc-admin-link">
                  {h.linkLabel}
                </a>
              </li>
            ))}
          </ul>
        )}
        <p className="pc-order__muted" data-testid="today-startklar">
          {adminText('todayStartklarLater')}
        </p>
      </section>

      <LegalTextsTile rows={summary.legalTexts} href={href(adminViewPath('texte'))} />

      <section className="pc-order__section" aria-labelledby="today-recent-title">
        <h2 id="today-recent-title">{adminText('todayRecent')}</h2>
        {summary.recentOrders.length === 0 ? (
          <p>{adminText('todayRecentNone')}</p>
        ) : (
          <ul className="pc-order__list" data-testid="today-recent">
            {summary.recentOrders.map((o) => (
              <li key={o.id} className="pc-today__order" data-testid="today-recent-order">
                <a href={href(adminViewPath('bestellung', o.id))} className="pc-admin-link">
                  {o.orderNumber}
                </a>
                <span>{formatEuroInput(o.totalCents)} €</span>
                <StatusBadge>{o.statusLabel}</StatusBadge>
                {o.seed ? <StatusBadge tone="info">{adminText('todaySeed')}</StatusBadge> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
