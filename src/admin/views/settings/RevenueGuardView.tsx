import React from 'react'

import { ENUM_LABELS } from '@/lib/enumLabels'
import { REVENUE_GUARD_STAGES, REVENUE_SOURCES, type RevenueGuardStage } from '@/lib/enums'
import { getRevenueStatus } from '@/lib/revenue/check'
import {
  formatSignedEuro,
  parseLastNotified,
  REVENUE_COLUMNS,
  REVENUE_GUARD_DISCLAIMER,
  STAGE_TITLES,
  stageMessage,
  type RevenueColumn,
} from '@/lib/revenue/guard'
import { addBerlinMonths, berlinMonthKey } from '@/lib/time'

import { Notice } from '../../components/Notice'
import { StatusBadge } from '../../components/StatusBadge'
import { adminText } from '../../translations'
import type { AdminViewBodyProps } from '../AdminViewBody'
import { RevenueEntryForm, YearTotalsForm } from './AreaForms'
import { initialAreaValues, type Obj } from './settingsAreas'

// Einstellungen → Umsatz-Wächter `/einstellungen/umsatz-waechter` (PLAN P5.23, KONZEPT §8.4, R-125): Balken mit Stand
// und Schwellen, Monatstabelle (Shop, Tattoo, Flohmarkt, Auftragsarbeiten, Sonstiges) mit Eingabe der manuellen
// Monatssummen, Jahressummen vor dem Shop (dieselbe Komponente wie in Einstellungen → Steuer, P5.22a), Verlauf der
// gemeldeten Stufen und der Satz „Der Wächter ersetzt keine Steuerberatung.“ Daten aus `getRevenueStatus()`.

const COLUMN_LABEL = (c: RevenueColumn) =>
  c === 'shop' ? adminText('revenueShop') : ENUM_LABELS.REVENUE_SOURCES[c].de
const MONTH_NAMES = [
  'Jan.',
  'Feb.',
  'März',
  'Apr.',
  'Mai',
  'Juni',
  'Juli',
  'Aug.',
  'Sep.',
  'Okt.',
  'Nov.',
  'Dez.',
]
const monthLabel = (key: string) => `${MONTH_NAMES[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`

export async function RevenueGuardView({ req }: AdminViewBodyProps) {
  const now = new Date()
  const settingsDe = (await req.payload.findGlobal({
    slug: 'settings',
    depth: 0,
    locale: 'de',
    fallbackLocale: false,
    overrideAccess: true,
    req,
  })) as unknown as Obj
  const status = await getRevenueStatus(req.payload, now, { settings: settingsDe })
  const t = status.thresholds
  const limit = t.currentYearLimitCents
  const pct = (cents: number) => Math.max(0, Math.min(100, (cents / limit) * 100))
  const marks = [
    { stage: 'U1' as const, cents: t.u1Cents },
    { stage: 'U2' as const, cents: t.previousYearLimitCents },
    { stage: 'U3' as const, cents: t.u3Cents },
    { stage: 'U3a' as const, cents: t.u3aCents },
    { stage: 'U4' as const, cents: t.u4Cents },
    { stage: 'U5' as const, cents: t.currentYearLimitCents },
  ]
  const reached = new Set(status.reached.map((s) => s.stage))
  const history = Object.entries(
    parseLastNotified((settingsDe.revenueGuard as Obj | undefined)?.lastNotified),
  ).sort(([a], [b]) => Number(b) - Number(a))
  const area = initialAreaValues(settingsDe, {})
  // Eingabe: Monate bis zum Vormonat bzw. laufenden Monat (keine Zukunft, Regel der Collection).
  const currentMonth = berlinMonthKey(now)
  const months = Array.from({ length: 13 }, (_, i) => berlinMonthKey(addBerlinMonths(now, -i)))
  const visibleMonths = status.months.filter((m) => m.month <= currentMonth)

  return (
    <div className="pc-order pc-settings" data-testid="settings-revenue-view">
      <section className="pc-order__section" aria-labelledby="revenue-state">
        <h2 id="revenue-state">{adminText('revenueState', { year: status.year })}</h2>
        <p className="pc-revenue__total" data-testid="revenue-total">
          <strong>{formatSignedEuro(status.totalCents)}</strong>{' '}
          {adminText('revenueOf', { limit: formatSignedEuro(limit) })}
        </p>
        <div
          className="pc-revenue__bar"
          role="img"
          aria-label={adminText('revenueBarLabel', {
            total: formatSignedEuro(status.totalCents),
            limit: formatSignedEuro(limit),
          })}
          data-testid="revenue-bar"
        >
          <span className="pc-revenue__fill" style={{ width: `${pct(status.totalCents)}%` }} />
          {marks.map((m) => (
            <span
              key={m.stage}
              className="pc-revenue__mark"
              style={{ left: `${pct(m.cents)}%` }}
              aria-hidden="true"
            />
          ))}
        </div>
        <ul className="pc-order__items" data-testid="revenue-stages">
          {marks.map((m) => (
            <li key={m.stage} className="pc-order__item">
              <span>
                <strong>{m.stage}</strong> · {STAGE_TITLES[m.stage]} · {formatSignedEuro(m.cents)}{' '}
                {reached.has(m.stage) ? (
                  <StatusBadge tone="warning">{adminText('revenueReached')}</StatusBadge>
                ) : (
                  <StatusBadge tone="neutral">{adminText('revenueOpen')}</StatusBadge>
                )}
              </span>
            </li>
          ))}
        </ul>
        {status.current ? (
          <Notice tone="warning" data-testid="revenue-current">
            {stageMessage(status.current, {
              year: status.year,
              totalCents: status.totalCents,
              thresholds: t,
            })}
          </Notice>
        ) : null}
        {reached.has('U0') ? (
          <Notice tone="warning">
            {stageMessage('U0', {
              year: status.year,
              totalCents: status.totalCents,
              thresholds: t,
            })}
          </Notice>
        ) : null}
        <p className="pc-order__muted">
          {adminText('revenuePrevious', {
            year: status.previousYear,
            total: formatSignedEuro(status.previousYearTotalCents),
          })}
        </p>
        <p data-testid="revenue-disclaimer">
          <strong>{REVENUE_GUARD_DISCLAIMER}</strong>
        </p>
      </section>

      <section className="pc-order__section" aria-labelledby="revenue-months">
        <h2 id="revenue-months">{adminText('revenueMonths')}</h2>
        <div
          className="pc-revenue__scroll"
          tabIndex={0}
          role="region"
          aria-labelledby="revenue-months"
        >
          <table className="pc-revenue__table" data-testid="revenue-table">
            <thead>
              <tr>
                <th scope="col">{adminText('revenueMonth')}</th>
                {REVENUE_COLUMNS.map((c) => (
                  <th key={c} scope="col">
                    {COLUMN_LABEL(c)}
                  </th>
                ))}
                <th scope="col">{adminText('revenueSum')}</th>
              </tr>
            </thead>
            <tbody>
              {visibleMonths.map((m) => (
                <tr key={m.month}>
                  <th scope="row">{monthLabel(m.month)}</th>
                  {REVENUE_COLUMNS.map((c) => (
                    <td key={c}>{formatSignedEuro(m.cents[c])}</td>
                  ))}
                  <td>{formatSignedEuro(m.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3>{adminText('revenueEntryTitle')}</h3>
        <p className="pc-order__muted">{adminText('revenueEntryHint')}</p>
        <RevenueEntryForm
          months={months.map((m) => ({ value: m, label: monthLabel(m) }))}
          sources={REVENUE_SOURCES.map((s) => ({
            value: s,
            label: ENUM_LABELS.REVENUE_SOURCES[s].de,
          }))}
        />
      </section>

      <section className="pc-order__section" aria-labelledby="revenue-years">
        <h2 id="revenue-years">{adminText('revenueYearsTitle')}</h2>
        <YearTotalsForm initial={area.yearTotals} idPrefix="revenue" />
      </section>

      <section className="pc-order__section" aria-labelledby="revenue-history">
        <h2 id="revenue-history">{adminText('revenueHistory')}</h2>
        {history.length === 0 ? (
          <p data-testid="revenue-history-none">{adminText('revenueHistoryNone')}</p>
        ) : (
          <ul className="pc-order__items" data-testid="revenue-history">
            {history.map(([year, stages]) => (
              <li key={year} className="pc-order__item">
                <span>
                  <strong>{year}</strong>:{' '}
                  {[...stages]
                    .sort(
                      (a, b) =>
                        REVENUE_GUARD_STAGES.indexOf(a as RevenueGuardStage) -
                        REVENUE_GUARD_STAGES.indexOf(b as RevenueGuardStage),
                    )
                    .map((s) => `${s} (${STAGE_TITLES[s as RevenueGuardStage]})`)
                    .join(', ')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
