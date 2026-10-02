import React from 'react'

import { DATEV_FIELD_LABELS, datevConfigStatus } from '@/lib/export/datev'
import { addBerlinMonths, berlinMonthKey, berlinYear } from '@/lib/time'
import type { Setting } from '@/payload-types'

import { PackagingYearTotal } from '../../components/PackagingYearTotal'
import { adminText } from '../../translations'
import type { AdminViewBodyProps } from '../AdminViewBody'
import { adminView } from '../registry'
import { MonthExport } from './MonthExport'

// „Export und Datenschutz“ `/export` (KONZEPT §7.15): Monats-CSV und Rechnungs-ZIP (PLAN P5.24, R-124) und
// DATEV-Buchungsstapel (P5.25) mit Monatsauswahl; Jahres-Export der Verpackungsmengen (P5.11, R-201) als einfaches
// GET-Formular (funktioniert ohne JavaScript). Exporte enthalten nie Beispieldaten. Darunter die Datenschutz-Werkzeuge
// (`/export/datenschutz`, P6.16–P6.18) und die Mail- und Einwilligungs-Protokolle (`/export/protokolle`, P6.19).

const MONTH_NAMES = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

export async function ExportView({ req, adminRoute }: AdminViewBodyProps) {
  const now = new Date()
  const current = berlinYear(now)
  const years = [current, current - 1, current - 2]
  const months = Array.from({ length: 25 }, (_, i) => berlinMonthKey(addBerlinMonths(now, -i)))
  const settings = (await req.payload.findGlobal({
    slug: 'settings',
    depth: 0,
    overrideAccess: true,
    req,
  })) as Setting
  const datev = datevConfigStatus(settings.export?.datev)
  return (
    <div className="pc-order">
      <section className="pc-order__section" aria-labelledby="export-month-title">
        <h2 id="export-month-title">{adminText('exportMonthTitle')}</h2>
        <p>{adminText('exportMonthIntro')}</p>
        <MonthExport
          months={months.map((m) => ({
            value: m,
            label: `${MONTH_NAMES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`,
          }))}
          initial={months[1]!}
          datevMissing={datev.ready ? [] : datev.missing.map((f) => DATEV_FIELD_LABELS[f])}
        />
      </section>
      <section className="pc-order__section" aria-labelledby="export-packaging">
        <h2 id="export-packaging">{adminText('exportPackagingTitle')}</h2>
        <p>{adminText('exportPackagingHint')}</p>
        <PackagingYearTotal payload={req.payload} year={current} />
        <form
          method="get"
          action="/api/admin/packaging-report"
          className="pc-admin-row pc-order__form"
          data-testid="packaging-report-form"
        >
          <div className="pc-field">
            <label htmlFor="packaging-year" className="pc-field__label">
              {adminText('exportPackagingYear')}
            </label>
            <select id="packaging-year" name="year" defaultValue={String(current)}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="pc-admin-btn pc-admin-btn--primary">
            {adminText('exportPackagingDownload')}
          </button>
        </form>
      </section>
      <section className="pc-order__section" aria-labelledby="export-privacy">
        <h2 id="export-privacy">{adminText('exportPrivacyTitle')}</h2>
        <p>{adminText('exportPrivacyIntro')}</p>
        <p className="pc-admin-row">
          <a
            href={`${adminRoute}${adminView('datenschutz').path}`}
            className="pc-admin-btn pc-admin-btn--secondary"
            data-testid="export-privacy-link"
          >
            {adminText('exportPrivacyOpen')}
          </a>
          <a
            href={`${adminRoute}${adminView('protokolle').path}`}
            className="pc-admin-btn pc-admin-btn--secondary"
            data-testid="export-logs-link"
          >
            {adminText('exportLogsOpen')}
          </a>
        </p>
      </section>
    </div>
  )
}
