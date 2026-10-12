import React from 'react'

import { ENUM_LABELS } from '@/lib/enumLabels'
import {
  PRODUCT_CATEGORIES,
  REVENUE_GUARD_STAGES,
  REVENUE_SOURCES,
  SOLD_CHANNELS,
  type RevenueGuardStage,
} from '@/lib/enums'
import { formatItemNumber } from '@/lib/products/itemNumber'
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
import { monthCloseStates } from '@/lib/revenue/monthClose'
import {
  REVIEW_ABANDONED_DAYS,
  REVIEW_LONG_DAYS,
  REVIEW_SALES_MONTHS,
  workshopReview,
  type WorkshopReview,
} from '@/lib/revenue/review'
import { addBerlinMonths, berlinMonthKey } from '@/lib/time'

import { Notice } from '../../components/Notice'
import { StatusBadge } from '../../components/StatusBadge'
import { adminText } from '../../translations'
import type { AdminViewBodyProps } from '../AdminViewBody'
import { MonthCloseForm, YearTotalsForm } from './AreaForms'
import { initialAreaValues, type Obj } from './settingsAreas'

// Einstellungen → Umsatz-Wächter `/einstellungen/umsatz-waechter` (PLAN P5.23, KONZEPT §8.4, R-125): Balken mit Stand
// und Schwellen, Monatstabelle (Shop, Tattoo, Flohmarkt, Auftragsarbeiten, Sonstiges; dazu „Markt-Verkäufe (Stücke)“
// aus „Offline verkauft“ mit Preis, U-60) mit dem Formular „Monat abschließen“ (V-38: vier Beträge, ein Knopf; Ziel des
// Links der Monatsmail A11 mit `?monat=JJJJ-MM`), Jahressummen vor dem Shop (nur hier, V-37), der Werkstatt-Rückblick
// aus den eigenen Verkaufsdaten (V-40, ohne Besucherdaten), Verlauf der gemeldeten Stufen und der Satz „Der Wächter
// ersetzt keine Steuerberatung.“ Daten aus `getRevenueStatus()`, `monthCloseStates()` und `workshopReview()`.

const COLUMN_LABEL = (c: RevenueColumn) =>
  c === 'shop'
    ? adminText('revenueShop')
    : c === 'offline'
      ? adminText('revenueOffline')
      : ENUM_LABELS.REVENUE_SOURCES[c].de
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

function param(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? ''
}

const pieceLabel = (p: { itemNumber: number | null; title: string }) =>
  p.itemNumber === null ? p.title : `${formatItemNumber(p.itemNumber, 'de')} · ${p.title}`

/** Werkstatt-Rückblick (V-40): Verkäufe je Kategorie und Weg, Liegezeit, „liegt lange“, „fast gekauft“. */
function WorkshopReviewSection({ review }: { review: WorkshopReview }) {
  const categories = PRODUCT_CATEGORIES.filter((c) =>
    SOLD_CHANNELS.some((ch) => review.sales[c][ch] > 0),
  )
  return (
    <section
      className="pc-order__section"
      aria-labelledby="revenue-review"
      data-testid="revenue-review"
    >
      <h2 id="revenue-review">{adminText('reviewTitle')}</h2>
      <p className="pc-order__muted">{adminText('reviewIntro')}</p>
      <h3 id="revenue-review-sales">{adminText('reviewSales', { months: REVIEW_SALES_MONTHS })}</h3>
      {review.salesTotal === 0 ? (
        <p data-testid="revenue-review-sales-none">{adminText('reviewSalesNone')}</p>
      ) : (
        <div
          className="pc-revenue__scroll"
          tabIndex={0}
          role="region"
          aria-labelledby="revenue-review-sales"
        >
          <table className="pc-revenue__table" data-testid="revenue-review-sales">
            <thead>
              <tr>
                <th scope="col">{adminText('reviewCategory')}</th>
                {SOLD_CHANNELS.map((ch) => (
                  <th key={ch} scope="col">
                    {adminText(
                      ch === 'online'
                        ? 'reviewChannelOnline'
                        : ch === 'pickup'
                          ? 'reviewChannelPickup'
                          : 'reviewChannelMarket',
                    )}
                  </th>
                ))}
                <th scope="col">{adminText('revenueSum')}</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c} data-category={c}>
                  <th scope="row">{ENUM_LABELS.PRODUCT_CATEGORIES[c].de}</th>
                  {SOLD_CHANNELS.map((ch) => (
                    <td key={ch}>{review.sales[c][ch]}</td>
                  ))}
                  <td>{SOLD_CHANNELS.reduce((n, ch) => n + review.sales[c][ch], 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p data-testid="revenue-review-average">
        {review.averageDaysToSale === null
          ? adminText('reviewAverageNone')
          : adminText('reviewAverage', {
              days: review.averageDaysToSale,
              n: review.averageBasis,
            })}
      </p>
      <h3>{adminText('reviewLong', { days: REVIEW_LONG_DAYS })}</h3>
      {review.longListed.length === 0 ? (
        <p data-testid="revenue-review-long-none">{adminText('reviewLongNone')}</p>
      ) : (
        <ul className="pc-order__items" data-testid="revenue-review-long">
          {review.longListed.map((p) => (
            <li key={p.id} className="pc-order__item" data-item={p.itemNumber ?? ''}>
              <span>
                {pieceLabel(p)} · {adminText('reviewLongDays', { days: p.days })}
              </span>
            </li>
          ))}
        </ul>
      )}
      <h3>{adminText('reviewAlmost', { days: REVIEW_ABANDONED_DAYS })}</h3>
      <p className="pc-order__muted">{adminText('reviewAlmostHint')}</p>
      {review.almostBought.length === 0 ? (
        <p data-testid="revenue-review-almost-none">{adminText('reviewAlmostNone')}</p>
      ) : (
        <ul className="pc-order__items" data-testid="revenue-review-almost">
          {review.almostBought.map((p) => (
            <li
              key={p.id}
              className="pc-order__item"
              data-item={p.itemNumber ?? ''}
              data-count={p.count}
            >
              <span>
                {pieceLabel(p)} ·{' '}
                {adminText(p.count === 1 ? 'reviewAlmostOnce' : 'reviewAlmostCount', {
                  n: p.count,
                })}
                {p.available ? null : (
                  <>
                    {' '}
                    <StatusBadge tone="neutral">{adminText('reviewAlmostGone')}</StatusBadge>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export async function RevenueGuardView({ req, searchParams }: AdminViewBodyProps) {
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
  const closeStates = await monthCloseStates(req.payload, months)
  const wanted = param(searchParams?.monat)
  const initialMonth = months.includes(wanted) ? wanted : (months[1] ?? currentMonth)
  const review = await workshopReview(req.payload, now)

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
        <h3 id="monat-abschliessen-titel">{adminText('revenueEntryTitle')}</h3>
        <p className="pc-order__muted">{adminText('revenueEntryHint')}</p>
        <p className="pc-order__muted" data-testid="revenue-offline-hint">
          {adminText('revenueOfflineHint')}
        </p>
        <MonthCloseForm
          months={closeStates.map((m) => ({
            value: m.month,
            label: monthLabel(m.month),
            amounts: m.amounts,
            marketCents: m.marketCents,
          }))}
          sources={REVENUE_SOURCES.map((s) => ({
            value: s,
            label: ENUM_LABELS.REVENUE_SOURCES[s].de,
          }))}
          initialMonth={initialMonth}
        />
      </section>

      <section className="pc-order__section" aria-labelledby="revenue-years">
        <h2 id="revenue-years">{adminText('revenueYearsTitle')}</h2>
        <YearTotalsForm initial={area.yearTotals} idPrefix="revenue" />
      </section>

      <WorkshopReviewSection review={review} />

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
